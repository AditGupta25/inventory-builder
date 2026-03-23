import Anthropic from '@anthropic-ai/sdk';
import pLimit from 'p-limit';

let client = null;
let apiAvailable = true;

try {
  client = new Anthropic();
} catch (err) {
  console.warn('Anthropic SDK init failed:', err.message);
  apiAvailable = false;
}

const limit = pLimit(3);
const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];

async function callWithRetry(fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.error?.status;
      const message = err?.error?.error?.message || err?.message || '';

      // Non-retryable errors: auth, billing, invalid request
      if (status === 400 || status === 401 || status === 403) {
        console.warn(`Claude API non-retryable error (${status}): ${message}`);
        apiAvailable = false;
        throw err;
      }

      const retryable = status === 429 || (status >= 500 && status < 600);
      if (!retryable || attempt === MAX_RETRIES) throw err;

      const delay = RETRY_DELAYS[attempt] || 3000;
      console.warn(`Claude API ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Check if the Claude API is available.
 */
export function isAPIAvailable() {
  return apiAvailable && client !== null;
}

/**
 * Call Claude and return raw text response.
 * Throws if API is unavailable — callers should catch and use fallbacks.
 */
export async function callClaude(systemPrompt, userMessage, options = {}) {
  if (!apiAvailable || !client) {
    throw new Error('Claude API is not available (check billing/API key)');
  }

  return limit(() =>
    callWithRetry(async () => {
      const response = await client.messages.create({
        model: options.model || model,
        max_tokens: options.maxTokens || 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      return response.content[0].text;
    })
  );
}

/**
 * Call Claude and parse JSON from response.
 * Handles markdown-fenced JSON blocks (```json ... ```)
 */
export async function callClaudeJSON(systemPrompt, userMessage, options = {}) {
  const text = await callClaude(systemPrompt, userMessage, options);
  return extractJSON(text);
}

function extractJSON(text) {
  // Try to extract from markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find the first { or [ and parse from there
    const start = jsonStr.search(/[{\[]/);
    if (start === -1) throw new Error('No JSON found in Claude response');
    const end = jsonStr.lastIndexOf(jsonStr[start] === '{' ? '}' : ']');
    if (end === -1) throw new Error('Malformed JSON in Claude response');
    return JSON.parse(jsonStr.slice(start, end + 1));
  }
}
