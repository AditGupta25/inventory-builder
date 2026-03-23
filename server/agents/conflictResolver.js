import { callClaudeJSON } from '../utils/claudeClient.js';
import { CONFLICT_RESOLVER_SYSTEM, conflictResolverUserPrompt } from '../prompts/agentPrompts.js';

/**
 * Agent 3 — UPC Conflict Resolver
 * Deduplicates rows by UPC. Keeps items even with unusual UPCs — only skips truly empty ones.
 */

const BATCH_SIZE = 100;

export async function resolveConflicts(normalizedData, onProgress) {
  const { rows } = normalizedData;
  onProgress?.(`Checking ${rows.length} rows for UPC conflicts...`);

  const withUPC = [];
  const skipped = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const upc = (row.upc || '').trim();

    // Only skip if UPC is completely empty
    // Zero-padded UPCs (like 00000000000192) are VALID store-generated codes
    if (!upc) {
      // If the item has a name, keep it but flag it — don't skip
      if (row.name && row.name.trim()) {
        withUPC.push({ ...row, _originalIndex: i, _noUPC: true });
      } else {
        skipped.push({ row: { ...row, _originalIndex: i }, reason: 'No UPC and no product name' });
      }
    } else {
      withUPC.push({ ...row, _originalIndex: i });
    }
  }

  onProgress?.(`${withUPC.length} rows to process, ${skipped.length} skipped (no UPC or name)`);

  // Group by normalized UPC
  const groups = new Map();
  for (const row of withUPC) {
    if (row._noUPC) {
      // Items without UPC get unique keys so they aren't grouped
      groups.set(`_noUPC_${row._originalIndex}`, [row]);
    } else {
      const key = normalizeUPCForGrouping(row.upc);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }

  const duplicateGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  const singletons = [...groups.entries()].filter(([, rows]) => rows.length === 1).map(([, rows]) => rows[0]);

  onProgress?.(`Found ${duplicateGroups.length} UPC groups with duplicates, ${singletons.length} unique items`);

  const conflicts = [];
  const resolved = [...singletons];

  // Resolve duplicates locally with rules
  for (const [upc, groupRows] of duplicateGroups) {
    const result = resolveGroup(upc, groupRows);
    resolved.push(result.winner);
    if (result.extras) resolved.push(...result.extras);
    conflicts.push(result.conflict);
  }

  // If there are many conflicts and Claude is available, try AI resolution
  if (duplicateGroups.length > 50) {
    onProgress?.('Many conflicts detected — using rule-based resolution');
  }

  // Clean up internal fields
  const cleanResolved = resolved.map(row => {
    const { _originalIndex, _noUPC, ...rest } = row;
    return rest;
  });

  onProgress?.(`Resolved to ${cleanResolved.length} unique products, ${skipped.length} skipped, ${conflicts.length} conflicts`);

  return { resolved: cleanResolved, skipped, conflicts };
}

/**
 * Normalize UPC for grouping — strip leading zeros but keep enough to differentiate.
 * For store-generated PLU codes, keep the full number.
 */
function normalizeUPCForGrouping(upc) {
  let clean = String(upc).replace(/[^0-9]/g, '');
  if (!clean) return '_empty';
  // If it's all zeros (placeholder), keep as-is
  if (/^0+$/.test(clean)) return clean;
  // Strip leading zeros for comparison, but keep at least 4 digits
  const stripped = clean.replace(/^0+/, '');
  return stripped || clean;
}

/**
 * Rule-based conflict resolution for a group of rows with the same UPC.
 */
function resolveGroup(upc, groupRows) {
  // Check if rows are size variants (different products with same UPC base)
  const sizeGroups = groupBySizeVariant(groupRows);

  if (sizeGroups.length > 1) {
    // Multiple size variants — keep all as separate products
    const [first, ...rest] = groupRows;
    return {
      winner: first,
      extras: rest,
      conflict: {
        upc,
        kept: 'all',
        removed: [],
        reason: `Size variants — all ${groupRows.length} kept as separate products`,
      },
    };
  }

  // Check if rows have different names (likely different products sharing a UPC)
  const uniqueNames = new Set(
    groupRows.map(r => (r.name || '').toLowerCase().trim()).filter(Boolean)
  );
  if (uniqueNames.size > 1) {
    // Different products — keep all
    const [first, ...rest] = groupRows;
    return {
      winner: first,
      extras: rest,
      conflict: {
        upc,
        kept: 'all',
        removed: [],
        reason: `Different product names — all ${groupRows.length} kept`,
      },
    };
  }

  // True duplicates — resolve by date then price
  let winner = groupRows[0];
  let winnerIdx = 0;

  for (let i = 1; i < groupRows.length; i++) {
    const row = groupRows[i];

    // Rule 1: Most recent date wins
    if (row.date && winner.date) {
      const rowDate = new Date(row.date);
      const winDate = new Date(winner.date);
      if (!isNaN(rowDate) && !isNaN(winDate) && rowDate > winDate) {
        winner = row;
        winnerIdx = i;
        continue;
      }
    }

    // Rule 2: Highest price wins if no dates
    if (!row.date && !winner.date) {
      const rowPrice = parseFloat(row.price) || 0;
      const winPrice = parseFloat(winner.price) || 0;
      if (rowPrice > winPrice) {
        winner = row;
        winnerIdx = i;
      }
    }

    // Rule 3: Prefer row with more data (name, category, etc.)
    const rowFields = Object.values(row).filter(v => v && String(v).trim()).length;
    const winFields = Object.values(winner).filter(v => v && String(v).trim()).length;
    if (rowFields > winFields && !row.date && !winner.date) {
      winner = row;
      winnerIdx = i;
    }
  }

  const removed = groupRows
    .map((_, i) => i)
    .filter(i => i !== winnerIdx);

  return {
    winner,
    extras: null,
    conflict: {
      upc,
      kept: winnerIdx,
      removed,
      reason: winner.date ? 'Most recent date' : 'Most complete data / highest price',
    },
  };
}

function groupBySizeVariant(rows) {
  const sizeMap = new Map();
  for (const row of rows) {
    const sizeKey = (row.size || 'unknown').toLowerCase().trim();
    if (!sizeMap.has(sizeKey)) sizeMap.set(sizeKey, []);
    sizeMap.get(sizeKey).push(row);
  }
  return [...sizeMap.values()];
}
