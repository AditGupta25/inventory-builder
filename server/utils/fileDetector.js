import { readFile } from 'fs/promises';
import path from 'path';

const MAGIC_BYTES = {
  xlsx: [0x50, 0x4B, 0x03, 0x04], // PK (ZIP container)
  xls: [0xD0, 0xCF, 0x11, 0xE0],  // OLE2 Compound Document
  pdf: [0x25, 0x50, 0x44, 0x46],   // %PDF
};

const EXTENSION_MAP = {
  '.xlsx': 'xlsx',
  '.xls': 'xls',
  '.csv': 'csv',
  '.tsv': 'tsv',
  '.pdf': 'pdf',
  '.txt': 'csv', // treat plain text as CSV
};

const DELIMITERS = [
  { char: '\t', name: 'tab' },
  { char: ',', name: 'comma' },
  { char: ';', name: 'semicolon' },
  { char: '|', name: 'pipe' },
];

/**
 * Detect file type using magic bytes first, extension fallback.
 * For CSV/TSV, also detect the delimiter.
 */
export async function detectFileType(filePath) {
  const buffer = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Check magic bytes
  for (const [type, magic] of Object.entries(MAGIC_BYTES)) {
    if (buffer.length >= magic.length && magic.every((b, i) => buffer[i] === b)) {
      return { type, delimiter: null };
    }
  }

  // Extension fallback
  const typeFromExt = EXTENSION_MAP[ext];
  if (typeFromExt && typeFromExt !== 'csv' && typeFromExt !== 'tsv') {
    return { type: typeFromExt, delimiter: null };
  }

  // For text-based files, detect delimiter
  const text = buffer.toString('utf-8').slice(0, 4096);
  const delimiter = detectDelimiter(text);

  if (ext === '.tsv' || delimiter.name === 'tab') {
    return { type: 'tsv', delimiter: '\t' };
  }

  return { type: 'csv', delimiter: delimiter.char };
}

function detectDelimiter(text) {
  const lines = text.split('\n').slice(0, 10).filter(l => l.trim());
  if (lines.length === 0) return DELIMITERS[1]; // default comma

  // Count occurrences of each delimiter across lines
  const scores = DELIMITERS.map(d => {
    const counts = lines.map(line => line.split(d.char).length - 1);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    // Consistency: low variance = likely the right delimiter
    const variance = counts.reduce((sum, c) => sum + (c - avg) ** 2, 0) / counts.length;
    return { ...d, avg, variance, score: avg > 0 ? avg / (1 + variance) : 0 };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0].avg > 0 ? scores[0] : DELIMITERS[1];
}
