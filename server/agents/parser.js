import { readFile } from 'fs/promises';
import { parse as csvParse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { callClaudeJSON } from '../utils/claudeClient.js';
import { PARSER_SYSTEM, parserUserPrompt } from '../prompts/agentPrompts.js';

/**
 * Agent 1 — File Parser
 * Reads raw files and extracts tabular data.
 * Handles messy formats: preamble rows, merged cells, null column gaps, varied schemas.
 */
export async function parseFile(filePath, fileType, delimiter, onProgress) {
  onProgress?.('Starting file parsing...');

  switch (fileType) {
    case 'csv':
    case 'tsv':
      return parseCSV(filePath, delimiter, onProgress);
    case 'xlsx':
    case 'xls':
      return parseXLSX(filePath, onProgress);
    case 'pdf':
      return parsePDF(filePath, onProgress);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

// ─── Known header keywords (lowercase) that indicate a row is a header ───
const HEADER_KEYWORDS = new Set([
  'upc', 'sku', 'plu', 'barcode', 'item', 'product', 'description', 'desc',
  'name', 'price', 'cost', 'retail', 'qty', 'quantity', 'department', 'dept',
  'category', 'brand', 'size', 'unit', 'date', 'total', 'sales', 'amount',
  'tax', 'sellunit', 'sell unit', 'domain', 'reason', 'code', 'number',
  'cust', 'items', 'images', 'weight', 'volume', 'count', 'stock',
]);

/**
 * Score a row as a potential header. Higher = more likely to be a header row.
 */
function scoreAsHeader(values) {
  const nonEmpty = values.filter(v => v && String(v).trim());
  if (nonEmpty.length < 2) return 0;

  let score = 0;
  for (const val of nonEmpty) {
    const lower = String(val).toLowerCase().trim();
    // Direct keyword match
    if (HEADER_KEYWORDS.has(lower)) { score += 3; continue; }
    // Partial keyword match (e.g., "PLU Number", "Tot Sales", "%Sales")
    const words = lower.split(/[\s/_%#]+/);
    for (const word of words) {
      if (word.length >= 3 && HEADER_KEYWORDS.has(word)) { score += 2; break; }
    }
    // Penalize if it's purely numeric (headers shouldn't be numbers)
    if (/^[\d.,\-$%]+$/.test(lower)) score -= 1;
    // Short text labels are likely headers
    if (lower.length < 30 && /^[a-z]/.test(lower)) score += 0.5;
  }

  // Bonus for having many non-empty cells (headers tend to be full rows)
  score += Math.min(nonEmpty.length * 0.3, 3);

  return score;
}

async function parseCSV(filePath, delimiter, onProgress) {
  const content = await readFile(filePath, 'utf-8');
  const allRows = csvParse(content, {
    delimiter: delimiter || ',',
    relax_column_count: true,
    skip_empty_lines: false,
    trim: true,
  });

  onProgress?.(`Parsed ${allRows.length} raw rows, detecting header...`);

  // Score each of the first 30 rows to find the best header
  let bestHeaderIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(allRows.length, 30); i++) {
    const score = scoreAsHeader(allRows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIdx = i;
    }
  }

  const rawHeaders = allRows[bestHeaderIdx];
  const headers = cleanHeaders(rawHeaders);
  const dataRows = allRows.slice(bestHeaderIdx + 1).filter(row => row.some(c => c && c.trim()));

  onProgress?.(`Found header at row ${bestHeaderIdx + 1} (score: ${bestScore.toFixed(1)}), extracted ${dataRows.length} data rows`);

  const rows = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });

  return { headers, rows, preambleSkipped: bestHeaderIdx, rawRowCount: allRows.length };
}

async function parseXLSX(filePath, onProgress) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('No worksheets found in file');

  onProgress?.(`Reading worksheet "${sheet.name}" with ${sheet.rowCount} rows`);

  // Determine actual column count from the sheet
  const colCount = sheet.columnCount || 20;

  const allRows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = new Array(colCount).fill('');
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      let val = cell.value;
      if (val && typeof val === 'object') {
        if (val.result !== undefined) val = val.result;
        else if (val.richText) val = val.richText.map(r => r.text).join('');
        else if (val.text) val = val.text;
        else if (val instanceof Date) val = val.toISOString().split('T')[0];
        else val = String(val);
      }
      if (colNum - 1 < colCount) {
        values[colNum - 1] = val != null ? String(val).trim() : '';
      }
    });
    allRows.push({ rowNum, values });
  });

  // Score each of the first 30 rows to find the best header
  let bestHeaderIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(allRows.length, 30); i++) {
    const score = scoreAsHeader(allRows[i].values);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIdx = i;
    }
  }

  // XLSX files with merged cells often have null gaps in the header row.
  // Some files also repeat headers across two rows. Check if next row is also header-like.
  const rawHeaders = allRows[bestHeaderIdx].values;
  let secondHeaderRow = null;
  if (bestHeaderIdx + 1 < allRows.length) {
    const nextScore = scoreAsHeader(allRows[bestHeaderIdx + 1].values);
    if (nextScore > bestScore * 0.5) {
      // Merge: fill nulls in first header from second header
      secondHeaderRow = allRows[bestHeaderIdx + 1].values;
    }
  }

  const mergedRaw = rawHeaders.map((h, i) => {
    if (h && h.trim()) return h;
    if (secondHeaderRow && secondHeaderRow[i] && secondHeaderRow[i].trim()) return secondHeaderRow[i];
    return '';
  });

  const headers = cleanHeaders(mergedRaw);
  const startIdx = secondHeaderRow ? bestHeaderIdx + 2 : bestHeaderIdx + 1;
  const dataRows = allRows.slice(startIdx);

  onProgress?.(`Found header at row ${allRows[bestHeaderIdx].rowNum} (score: ${bestScore.toFixed(1)}), extracted ${dataRows.length} data rows`);

  // Filter out rows that are completely empty or look like sub-headers/totals
  const rows = [];
  for (const { values } of dataRows) {
    const nonEmpty = values.filter(v => v && v.trim());
    if (nonEmpty.length < 2) continue; // skip near-empty rows
    // Skip total/summary rows
    const first = (values[0] || '').toLowerCase();
    if (first.includes('total') || first.includes('grand') || first.includes('sum')) continue;

    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    rows.push(obj);
  }

  return { headers, rows, preambleSkipped: bestHeaderIdx, rawRowCount: allRows.length };
}

async function parsePDF(filePath, onProgress) {
  onProgress?.('Loading PDF...');

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  // Extract ALL text items with X/Y positions across all pages
  const allPageRows = []; // Array of { y, items: [{ x, text }] }
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by Y position (with tolerance for slight misalignment)
    const yBuckets = new Map();
    for (const item of textContent.items) {
      if (!item.str.trim()) continue;
      const rawY = item.transform[5];
      // Find an existing Y bucket within ±2 units, or create a new one
      let bucketY = null;
      for (const existingY of yBuckets.keys()) {
        if (Math.abs(existingY - rawY) <= 2) { bucketY = existingY; break; }
      }
      if (bucketY === null) { bucketY = rawY; yBuckets.set(bucketY, []); }
      yBuckets.get(bucketY).push({ x: item.transform[4], text: item.str });
    }

    // Sort rows by Y descending (PDF coords: bottom=0, top=max)
    const sortedYs = [...yBuckets.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = yBuckets.get(y).sort((a, b) => a.x - b.x);
      allPageRows.push({ y, page: i, items });
    }

    onProgress?.(`Extracted text from page ${i}/${doc.numPages}`);
  }

  if (allPageRows.length === 0) {
    throw new Error('PDF contains no extractable text. Scanned/image PDFs are not supported.');
  }

  onProgress?.(`Reconstructed ${allPageRows.length} rows from PDF, detecting columns...`);

  // ─── X-Position-Based Column Detection ───
  // Step 1: Find the header row by scoring each row's text content
  let bestHeaderIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(allPageRows.length, 30); i++) {
    const texts = allPageRows[i].items.map(it => it.text);
    const score = scoreAsHeader(texts);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIdx = i;
    }
  }

  if (bestScore < 2) {
    // No clear header found — fall back to legacy text-based approach
    onProgress?.('No clear header found, falling back to text parsing...');
    return parsePDFFallback(allPageRows, onProgress);
  }

  const headerRow = allPageRows[bestHeaderIdx];
  const headerItems = headerRow.items;
  onProgress?.(`Found PDF header at row ${bestHeaderIdx + 1} (score: ${bestScore.toFixed(1)}) with ${headerItems.length} columns`);

  // Step 2: Define column boundaries from header X positions
  // Each column boundary = midpoint between this header's X and the next header's X
  const columns = [];
  for (let i = 0; i < headerItems.length; i++) {
    const leftEdge = i === 0 ? 0 : (headerItems[i].x + headerItems[i - 1].x) / 2;
    const rightEdge = i === headerItems.length - 1 ? Infinity : (headerItems[i].x + headerItems[i + 1].x) / 2;
    columns.push({
      name: headerItems[i].text.trim(),
      x: headerItems[i].x,
      left: leftEdge,
      right: rightEdge,
    });
  }

  // Step 3: Slot each data row's text items into the correct column
  const headers = cleanHeaders(columns.map(c => c.name));
  const dataPageRows = allPageRows.slice(bestHeaderIdx + 1);
  const rows = [];

  for (const { items } of dataPageRows) {
    if (items.length < 2) continue;

    const cells = new Array(columns.length).fill('');
    for (const item of items) {
      // Find which column this item belongs to based on X position
      let colIdx = columns.length - 1; // default to last column
      for (let c = 0; c < columns.length; c++) {
        if (item.x >= columns[c].left && item.x < columns[c].right) {
          colIdx = c;
          break;
        }
      }
      // Append text to the cell (items in same column on same row get joined with space)
      cells[colIdx] = cells[colIdx] ? cells[colIdx] + ' ' + item.text.trim() : item.text.trim();
    }

    // Skip rows that are empty or look like totals/summaries
    const nonEmpty = cells.filter(c => c.trim());
    if (nonEmpty.length < 2) continue;
    const firstCell = cells[0].toLowerCase();
    if (firstCell.includes('total') || firstCell.includes('grand') || firstCell.includes('page ')) continue;

    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    rows.push(obj);
  }

  onProgress?.(`Extracted ${rows.length} rows using column-position detection`);

  if (rows.length > 0) {
    return { headers, rows, preambleSkipped: bestHeaderIdx, rawRowCount: allPageRows.length };
  }

  // Fallback if column detection produced no rows
  return parsePDFFallback(allPageRows, onProgress);
}

/**
 * Fallback PDF parsing: join items as text lines, then use Claude or text parsing.
 */
async function parsePDFFallback(allPageRows, onProgress) {
  const allLines = allPageRows.map(({ items }) =>
    items.map(i => i.text).join('\t')
  ).filter(l => l.trim());

  // Try parseTextLines first
  const parsed = parseTextLines(allLines);
  if (parsed.rows.length > 0) {
    onProgress?.(`Extracted ${parsed.rows.length} rows from PDF using text-line parsing`);
    return parsed;
  }

  // Try Claude
  onProgress?.('Using AI to extract table structure from PDF...');
  try {
    const fullText = allLines.join('\n').slice(0, 12000);
    const result = await callClaudeJSON(PARSER_SYSTEM, parserUserPrompt(fullText, 'PDF'));
    const headers = result.headers || [];
    const rawRows = result.rows || [];
    const rows = rawRows.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
    onProgress?.(`AI extracted ${rows.length} rows from PDF`);
    return { headers, rows, preambleSkipped: result.preamble_rows_skipped || 0, rawRowCount: rawRows.length };
  } catch (err) {
    console.warn('Claude PDF parsing failed:', err.message);
    onProgress?.(`Falling back to text-based parsing (${allLines.length} lines)`);
    return parseFallbackText(allLines);
  }
}

/**
 * Parse tab-separated text lines (from PDF reconstruction) into structured data.
 */
function parseTextLines(lines) {
  if (lines.length < 2) return { headers: [], rows: [], preambleSkipped: 0, rawRowCount: 0 };

  // Split each line by tabs
  const splitLines = lines.map(l => l.split('\t').map(s => s.trim()));

  // Find best header
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(splitLines.length, 20); i++) {
    const score = scoreAsHeader(splitLines[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore < 2) return { headers: [], rows: [], preambleSkipped: 0, rawRowCount: 0 };

  const headers = cleanHeaders(splitLines[bestIdx]);
  const dataLines = splitLines.slice(bestIdx + 1);
  const rows = [];

  for (const cells of dataLines) {
    if (cells.length < 2) continue;
    const nonEmpty = cells.filter(c => c);
    if (nonEmpty.length < 2) continue;

    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    rows.push(obj);
  }

  return { headers, rows, preambleSkipped: bestIdx, rawRowCount: lines.length };
}

/**
 * Last-resort fallback: treat each line as a single-column record, split by whitespace patterns.
 */
function parseFallbackText(lines) {
  // Try splitting by multiple spaces
  const splitLines = lines.map(l => l.split(/\s{2,}/).map(s => s.trim()).filter(Boolean));
  const maxCols = Math.max(...splitLines.map(l => l.length));

  if (maxCols < 2) {
    // Truly unstructured text — return as single-column
    const headers = ['raw_text'];
    const rows = lines.filter(l => l.trim()).map(l => ({ raw_text: l.trim() }));
    return { headers, rows, preambleSkipped: 0, rawRowCount: lines.length };
  }

  // Generate column names and return
  const headers = Array.from({ length: maxCols }, (_, i) => `Column_${i + 1}`);
  const rows = splitLines.filter(l => l.length >= 2).map(cells => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    return obj;
  });

  return { headers, rows, preambleSkipped: 0, rawRowCount: lines.length };
}

/**
 * Clean header names: fill nulls, deduplicate, trim.
 */
function cleanHeaders(rawHeaders) {
  const seen = new Set();
  return rawHeaders.map((h, i) => {
    let name = h ? String(h).trim() : '';
    if (!name) name = `Column_${i + 1}`;
    // Deduplicate
    let final = name;
    let n = 2;
    while (seen.has(final.toLowerCase())) {
      final = `${name}_${n++}`;
    }
    seen.add(final.toLowerCase());
    return final;
  });
}
