import { parseFile } from './agents/parser.js';
import { normalizeFields } from './agents/normalizer.js';
import { resolveConflicts } from './agents/conflictResolver.js';
import { mapCategories } from './agents/categoryMapper.js';
import { formatInventory } from './agents/formatter.js';
import { validateQA } from './agents/qaValidator.js';
import { writeInventoryFiles } from './utils/xlsxWriter.js';

/**
 * Pipeline orchestrator — runs all 6 agents sequentially.
 * Stores intermediate data after each step for retry/debug.
 * Emits SSE events via the provided emitter function.
 */

const AGENTS = [
  { id: 'parser', name: 'File Parser', run: null },
  { id: 'normalizer', name: 'Field Normalizer', run: null },
  { id: 'conflictResolver', name: 'UPC Conflict Resolver', run: null },
  { id: 'categoryMapper', name: 'Category Mapper', run: null },
  { id: 'formatter', name: 'Inventory Formatter', run: null },
  { id: 'qaValidator', name: 'QA Validator', run: null },
];

const PLAYFUL_MESSAGES = [
  'Cracking open your file and reading every row...',
  'Teaching your columns proper names...',
  'Settling disputes between duplicate UPCs...',
  'Sorting products into their perfect categories...',
  'Polishing each row for the inventory template...',
  'Running final quality checks on everything...',
];

export async function runPipeline(filePath, fileType, delimiter, sessionId, emit) {
  const state = {
    steps: {},
    currentAgent: 0,
    startTime: Date.now(),
  };

  function progress(agentId, message, extra = {}) {
    emit({
      agent: state.currentAgent + 1,
      agent_name: AGENTS[state.currentAgent].name,
      agent_id: agentId,
      status: 'progress',
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }

  function agentStart(index) {
    state.currentAgent = index;
    emit({
      agent: index + 1,
      agent_name: AGENTS[index].name,
      agent_id: AGENTS[index].id,
      status: 'start',
      message: PLAYFUL_MESSAGES[index],
      timestamp: new Date().toISOString(),
    });
  }

  function agentComplete(index, extra = {}) {
    emit({
      agent: index + 1,
      agent_name: AGENTS[index].name,
      agent_id: AGENTS[index].id,
      status: 'complete',
      message: `${AGENTS[index].name} finished`,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }

  function agentError(index, error) {
    emit({
      agent: index + 1,
      agent_name: AGENTS[index].name,
      agent_id: AGENTS[index].id,
      status: 'error',
      message: error.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Agent 1: Parser
    agentStart(0);
    const parsed = await parseFile(filePath, fileType, delimiter, (msg) => progress('parser', msg));
    state.steps.parsed = parsed;
    agentComplete(0, { rows_processed: parsed.rows.length });

    // Agent 2: Normalizer
    agentStart(1);
    const normalized = await normalizeFields(parsed, (msg) => progress('normalizer', msg));
    state.steps.normalized = normalized;
    agentComplete(1, { rows_processed: normalized.rows.length });

    // Agent 3: Conflict Resolver
    agentStart(2);
    const conflicts = await resolveConflicts(normalized, (msg) => progress('conflictResolver', msg));
    state.steps.conflicts = conflicts;
    agentComplete(2, { rows_processed: conflicts.resolved.length, flags: conflicts.skipped.length });

    // Agent 4: Category Mapper
    agentStart(3);
    const categories = await mapCategories(conflicts, (msg) => progress('categoryMapper', msg));
    state.steps.categories = categories;
    agentComplete(3, { rows_processed: categories.categorized.length });

    // Agent 5: Formatter
    agentStart(4);
    const formatted = await formatInventory(categories, (msg) => progress('formatter', msg));
    state.steps.formatted = formatted;
    agentComplete(4, { rows_processed: formatted.clean.length, flags: formatted.flagged.length });

    // Agent 6: QA Validator
    agentStart(5);
    const qa = await validateQA(formatted, conflicts, (msg) => progress('qaValidator', msg));
    state.steps.qa = qa;
    agentComplete(5, { rows_processed: qa.summary.totalProcessed });

    // Write XLSX files
    progress('qaValidator', 'Generating Excel files...');
    const files = await writeInventoryFiles(formatted, qa, sessionId);

    const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);

    // Pipeline complete event
    emit({
      status: 'pipeline_complete',
      message: `Processing complete in ${elapsed}s`,
      timestamp: new Date().toISOString(),
      result: {
        cleanFile: files.cleanFile,
        flaggedFile: files.flaggedFile,
        qa,
        clean: formatted.clean.slice(0, 10), // Preview first 10 rows
        cleanCount: formatted.clean.length,
        flaggedCount: formatted.flagged.length,
        skipped: conflicts.skipped,
        conflicts: conflicts.conflicts,
        elapsed,
      },
    });

    return { formatted, qa, files, conflicts };
  } catch (err) {
    agentError(state.currentAgent, err);
    emit({
      status: 'pipeline_error',
      message: err.message || 'Pipeline failed',
      timestamp: new Date().toISOString(),
      failedAgent: AGENTS[state.currentAgent]?.id,
    });
    throw err;
  }
}
