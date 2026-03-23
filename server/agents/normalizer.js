import Fuse from 'fuse.js';
import { callClaudeJSON } from '../utils/claudeClient.js';
import { NORMALIZER_SYSTEM, normalizerUserPrompt } from '../prompts/agentPrompts.js';

/**
 * Agent 2 — Field Normalizer
 * Maps messy column names to canonical fields using fuzzy matching + value-based heuristics + Claude fallback.
 * Designed to handle ANY file format — every file will have different headers.
 */

const CANONICAL_FIELDS = [
  { name: 'upc', aliases: ['upc', 'upc code', 'barcode', 'gtin', 'ean', 'item #', 'item no', 'item number', 'product code', 'plu', 'plu number', 'plu #', 'plu code', 'scan code', 'upc/ean', 'upc-a', 'upc number'] },
  { name: 'name', aliases: ['name', 'product', 'product name', 'description', 'item', 'item name', 'item description', 'desc', 'product description', 'product/service name', 'title', 'product desc', 'item desc'] },
  { name: 'price', aliases: ['price', 'retail', 'retail price', 'store price', 'sell price', 'unit price', 'reg price', 'regular price', 'srp', 'msrp', 'selling price', 'each price'] },
  { name: 'cost', aliases: ['cost', 'wholesale', 'wholesale price', 'unit cost', 'cost price', 'buy price', 'vendor cost'] },
  { name: 'size', aliases: ['size', 'pack size', 'package size', 'pkg size', 'size/description', 'volume', 'weight', 'oz', 'ml', 'pack', 'sellunit', 'sell unit', 'unit size'] },
  { name: 'category', aliases: ['category', 'dept', 'department', 'class', 'product category', 'group', 'type', 'product type', 'dept name', 'department name'] },
  { name: 'subcategory', aliases: ['subcategory', 'sub-category', 'sub category', 'subclass', 'sub dept', 'sub department', 'subgroup', 'sub type'] },
  { name: 'quantity', aliases: ['quantity', 'qty', 'stock', 'on hand', 'count', 'inventory', 'units', 'items', 'cust', 'sold qty'] },
  { name: 'date', aliases: ['date', 'sale date', 'report date', 'last sold', 'last sale', 'sold date', 'transaction date'] },
  { name: 'brand', aliases: ['brand', 'brand name', 'manufacturer', 'vendor', 'supplier', 'mfg'] },
  { name: 'sku', aliases: ['sku', 'sku number', 'sku #', 'store sku', 'internal sku'] },
  { name: 'total_sales', aliases: ['total', 'tot sales', 'total sales', 'sales', 'revenue', 'gross sales', 'net sales', 'amount'] },
  { name: 'tax', aliases: ['tax', 'tax rate', 'tax rates', 'taxrates', 'tax code', 'taxable'] },
];

// Columns to ignore (common but useless for inventory)
const IGNORE_PATTERNS = [
  /^%/, /percent/i, /reason\s*code/i, /^sysid$/i, /^domain/i, /^column_\d+$/i,
  /^taxable\s*rebate/i, /^#$/, /^no\.?$/i,
];

// Build fuzzy search index
const allAliases = CANONICAL_FIELDS.flatMap(f =>
  f.aliases.map(a => ({ alias: a, canonical: f.name }))
);
const fuse = new Fuse(allAliases, { keys: ['alias'], threshold: 0.4, includeScore: true });

export async function normalizeFields(parsedData, onProgress) {
  const { headers, rows } = parsedData;
  onProgress?.(`Normalizing ${headers.length} columns across ${rows.length} rows...`);

  // Step 1: Map column names using aliases + fuzzy matching
  const mappings = {};
  const uncertain = [];
  const usedCanonicals = new Set();

  for (const header of headers) {
    const clean = header.toLowerCase().trim();

    // Check ignore patterns
    if (IGNORE_PATTERNS.some(p => p.test(clean))) {
      mappings[header] = { canonical: 'ignore', confidence: 1.0 };
      continue;
    }

    // Exact match
    const exact = allAliases.find(a => a.alias === clean);
    if (exact && !usedCanonicals.has(exact.canonical)) {
      mappings[header] = { canonical: exact.canonical, confidence: 1.0 };
      usedCanonicals.add(exact.canonical);
      continue;
    }

    // Partial keyword match — check if header CONTAINS a known alias
    let found = false;
    for (const alias of allAliases) {
      if (clean.includes(alias.alias) && !usedCanonicals.has(alias.canonical)) {
        mappings[header] = { canonical: alias.canonical, confidence: 0.85 };
        usedCanonicals.add(alias.canonical);
        found = true;
        break;
      }
    }
    if (found) continue;

    // Fuzzy match
    const results = fuse.search(clean);
    if (results.length > 0 && results[0].score < 0.35 && !usedCanonicals.has(results[0].item.canonical)) {
      mappings[header] = { canonical: results[0].item.canonical, confidence: 1 - results[0].score };
      usedCanonicals.add(results[0].item.canonical);
    } else {
      uncertain.push(header);
    }
  }

  // Step 2: Heuristic fallback — analyze sample VALUES to guess column type
  if (uncertain.length > 0) {
    onProgress?.(`${uncertain.length} unmapped columns, analyzing values...`);
    const sampleRows = rows.slice(0, 20);

    for (const header of uncertain) {
      if (mappings[header]) continue;
      const values = sampleRows.map(r => r[header]).filter(v => v && String(v).trim());
      const guessed = guessFieldFromValues(values, header, usedCanonicals);
      if (guessed) {
        mappings[header] = { canonical: guessed, confidence: 0.6 };
        usedCanonicals.add(guessed);
      }
    }
  }

  // Step 3: Claude fallback for still-uncertain columns (if API available)
  const stillUncertain = uncertain.filter(h => !mappings[h]);
  if (stillUncertain.length > 0) {
    onProgress?.(`${stillUncertain.length} still ambiguous, trying AI...`);
    const sampleRows = rows.slice(0, 5).map(row =>
      stillUncertain.reduce((obj, h) => { obj[h] = row[h]; return obj; }, {})
    );

    try {
      const aiResult = await callClaudeJSON(NORMALIZER_SYSTEM, normalizerUserPrompt(stillUncertain, sampleRows));
      if (aiResult.mappings) {
        for (const [col, mapping] of Object.entries(aiResult.mappings)) {
          if (mapping.canonical !== 'ignore' && !usedCanonicals.has(mapping.canonical)) {
            mappings[col] = { canonical: mapping.canonical, confidence: mapping.confidence || 0.7 };
            usedCanonicals.add(mapping.canonical);
          }
        }
      }
    } catch (err) {
      console.warn('Claude normalization fallback skipped:', err.message);
      // Just ignore remaining columns — the heuristic already caught the important ones
    }

    // Mark anything truly leftover as ignored
    for (const h of stillUncertain) {
      if (!mappings[h]) mappings[h] = { canonical: 'ignore', confidence: 0 };
    }
  }

  onProgress?.('Mapping columns and cleaning data...');

  // Log the final mapping for debugging
  const mapped = Object.entries(mappings)
    .filter(([, m]) => m.canonical !== 'ignore')
    .map(([h, m]) => `"${h}" → ${m.canonical} (${(m.confidence * 100).toFixed(0)}%)`)
    .join(', ');
  onProgress?.(`Column mapping: ${mapped}`);

  // Step 4: Apply mappings to all rows
  const normalizedRows = rows.map(row => {
    const normalized = {};
    for (const [header, mapping] of Object.entries(mappings)) {
      if (mapping.canonical === 'ignore') continue;
      const value = row[header];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        if (!normalized[mapping.canonical]) {
          normalized[mapping.canonical] = value;
        }
      }
    }

    // Clean specific fields
    if (normalized.upc) normalized.upc = cleanUPC(normalized.upc);
    if (normalized.price) normalized.price = cleanPrice(normalized.price);
    if (normalized.cost) normalized.cost = cleanPrice(normalized.cost);
    if (normalized.total_sales) normalized.total_sales = cleanPrice(normalized.total_sales);

    return normalized;
  });

  // Filter out rows that have essentially no useful data
  const usableRows = normalizedRows.filter(row => {
    const hasIdentifier = row.upc || row.name || row.sku;
    return hasIdentifier;
  });

  onProgress?.(`Normalized ${usableRows.length} usable rows (${normalizedRows.length - usableRows.length} empty rows removed)`);

  return {
    rows: usableRows,
    mappings,
    unmappedColumns: uncertain.filter(h => !mappings[h] || mappings[h].canonical === 'ignore'),
  };
}

/**
 * Guess a column's canonical type from its values.
 */
function guessFieldFromValues(values, headerName, usedCanonicals) {
  if (values.length === 0) return null;

  // UPC: long numeric strings, often 8-14 digits, may have leading zeros
  const allLongNumeric = values.every(v => /^\d{6,}/.test(String(v).replace(/[^0-9]/g, '')));
  if (allLongNumeric && !usedCanonicals.has('upc')) return 'upc';

  // Price: numbers with decimals, possibly $ prefix, typically 0.50 - 999.99
  const pricePattern = values.every(v => /^[$]?\d{1,4}[.,]\d{2}$/.test(String(v).trim().replace(/[^$0-9.,]/g, '')));
  if (pricePattern && !usedCanonicals.has('price')) return 'price';

  // Name/description: mixed text, usually longer strings
  const avgLen = values.reduce((sum, v) => sum + String(v).length, 0) / values.length;
  const mostlyText = values.filter(v => /[a-zA-Z]/.test(String(v))).length / values.length > 0.5;
  if (mostlyText && avgLen > 5 && !usedCanonicals.has('name')) return 'name';

  // Department: small integers (1-99)
  const allSmallInts = values.every(v => /^\d{1,2}$/.test(String(v).trim()));
  if (allSmallInts && !usedCanonicals.has('category')) return 'category';

  // Date: date-like patterns
  const datePattern = values.some(v => /\d{1,4}[/\-]\d{1,2}[/\-]\d{1,4}/.test(String(v)));
  if (datePattern && !usedCanonicals.has('date')) return 'date';

  return null;
}

function cleanUPC(val) {
  if (val == null) return '';
  let upc = String(val).trim();
  // Remove PLU-style suffix like "/000"
  upc = upc.replace(/\/\d{1,3}$/, '');
  // Remove non-numeric characters
  upc = upc.replace(/[^0-9]/g, '');
  // Strip excessive leading zeros but keep at least the meaningful part
  // UPCs should be 6-14 digits; if all zeros, it's invalid
  if (/^0+$/.test(upc)) return upc; // all zeros — will be flagged later
  return upc;
}

function cleanPrice(val) {
  if (val == null) return 0;
  const str = String(val).trim();
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
