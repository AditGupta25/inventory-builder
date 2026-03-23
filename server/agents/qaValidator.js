import { callClaudeJSON } from '../utils/claudeClient.js';
import { QA_VALIDATOR_SYSTEM, qaValidatorUserPrompt } from '../prompts/agentPrompts.js';

/**
 * Agent 6 — QA Validator
 * Reviews final inventory and produces a comprehensive QA report.
 */

export async function validateQA(formattedData, conflictData, onProgress) {
  const { clean, flagged } = formattedData;
  const { skipped, conflicts } = conflictData;
  onProgress?.(`Running QA validation on ${clean.length + flagged.length} items...`);

  // Local validation first
  const localIssues = runLocalChecks(clean, flagged);
  onProgress?.(`Found ${localIssues.length} issues locally`);

  // Use Claude for deeper analysis
  let aiReport = null;
  try {
    onProgress?.('AI reviewing data quality...');
    aiReport = await callClaudeJSON(
      QA_VALIDATOR_SYSTEM,
      qaValidatorUserPrompt(clean, flagged, conflicts, skipped),
      { maxTokens: 4096 }
    );
  } catch (err) {
    console.warn('Claude QA validation failed:', err.message);
  }

  // Merge local + AI issues
  const allIssues = [...localIssues];
  if (aiReport?.issues) {
    allIssues.push(...aiReport.issues);
  }

  // Deduplicate issues by message
  const seen = new Set();
  const uniqueIssues = allIssues.filter(issue => {
    const key = issue.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = {
    totalProcessed: clean.length + flagged.length + skipped.length,
    cleanCount: clean.length,
    flaggedCount: flagged.length,
    skippedCount: skipped.length,
    conflictsResolved: conflicts.length,
  };

  const qualityScore = aiReport?.qualityScore || calculateLocalScore(summary, uniqueIssues);
  const plainEnglishSummary = aiReport?.plainEnglishSummary || generateLocalSummary(summary, uniqueIssues);

  onProgress?.(`QA complete — Quality Score: ${qualityScore}/100`);

  return {
    summary,
    issues: uniqueIssues,
    qualityScore,
    plainEnglishSummary,
  };
}

function runLocalChecks(clean, flagged) {
  const issues = [];

  // Check for suspicious UPCs in clean items
  const shortUPCs = clean.filter(item => item.upc && item.upc.length < 8);
  if (shortUPCs.length > 0) {
    issues.push({
      severity: 'WARNING',
      field: 'upc',
      message: `${shortUPCs.length} items have UPCs shorter than 8 digits`,
      affectedItems: shortUPCs.slice(0, 10).map(i => i.upc),
    });
  }

  // Check for high prices
  const highPriced = clean.filter(item => item.storePrice > 50);
  if (highPriced.length > 0) {
    issues.push({
      severity: 'WARNING',
      field: 'price',
      message: `${highPriced.length} items priced above $50 (unusual for convenience store)`,
      affectedItems: highPriced.slice(0, 10).map(i => `${i.name}: $${i.storePrice}`),
    });
  }

  // Check for duplicate names with different UPCs
  const nameMap = new Map();
  for (const item of [...clean, ...flagged]) {
    const name = (item.name || '').toLowerCase().trim();
    if (!name) continue;
    if (!nameMap.has(name)) nameMap.set(name, []);
    nameMap.get(name).push(item.upc);
  }

  const dupeNames = [...nameMap.entries()].filter(([, upcs]) => {
    const unique = [...new Set(upcs)];
    return unique.length > 1;
  });

  if (dupeNames.length > 0) {
    issues.push({
      severity: 'INFO',
      field: 'name',
      message: `${dupeNames.length} product names appear with different UPCs (possible data entry errors)`,
      affectedItems: dupeNames.slice(0, 5).map(([name, upcs]) => `"${name}" → UPCs: ${[...new Set(upcs)].join(', ')}`),
    });
  }

  // Check for missing categories
  const uncategorized = clean.filter(item => !item.category || item.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    issues.push({
      severity: 'INFO',
      field: 'category',
      message: `${uncategorized.length} items are uncategorized`,
      affectedItems: uncategorized.slice(0, 10).map(i => i.name),
    });
  }

  // Check for missing size/unit
  const noSize = clean.filter(item => !item.sizeDescription);
  if (noSize.length > 0) {
    issues.push({
      severity: 'WARNING',
      field: 'size',
      message: `${noSize.length} items have no size information`,
      affectedItems: noSize.slice(0, 10).map(i => i.name),
    });
  }

  return issues;
}

function calculateLocalScore(summary, issues) {
  let score = 100;
  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;

  score -= errorCount * 10;
  score -= warningCount * 3;

  // Penalize high flagged/skipped ratio
  if (summary.totalProcessed > 0) {
    const problemRatio = (summary.flaggedCount + summary.skippedCount) / summary.totalProcessed;
    score -= Math.floor(problemRatio * 30);
  }

  return Math.max(0, Math.min(100, score));
}

function generateLocalSummary(summary, issues) {
  const parts = [];
  parts.push(`Processed ${summary.totalProcessed} items: ${summary.cleanCount} clean, ${summary.flaggedCount} flagged, ${summary.skippedCount} skipped.`);

  if (summary.conflictsResolved > 0) {
    parts.push(`Resolved ${summary.conflictsResolved} UPC conflicts.`);
  }

  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = issues.filter(i => i.severity === 'WARNING').length;

  if (errorCount > 0) {
    parts.push(`Found ${errorCount} errors that need attention.`);
  } else if (warningCount > 0) {
    parts.push(`Found ${warningCount} warnings to review.`);
  } else {
    parts.push('No critical issues found.');
  }

  return parts.join(' ');
}
