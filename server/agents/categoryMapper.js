import Fuse from 'fuse.js';
import { callClaudeJSON, isAPIAvailable } from '../utils/claudeClient.js';
import { CATEGORY_MAPPER_SYSTEM, categoryMapperUserPrompt } from '../prompts/agentPrompts.js';
import { STORE_CATEGORIES, buildKeywordMap, CATEGORY_NAMES } from '../utils/categoryMappings.js';

/**
 * Agent 4 — Category Mapper
 * Maps products to store categories using keyword matching + AI fallback.
 */

const keywordMap = buildKeywordMap();
const BATCH_SIZE = 30;

// Build Fuse index for fuzzy keyword matching
const allKeywords = [];
for (const [category, data] of Object.entries(STORE_CATEGORIES)) {
  for (const keyword of data.keywords) {
    allKeywords.push({ keyword, category });
  }
}
const fuse = new Fuse(allKeywords, { keys: ['keyword'], threshold: 0.3, includeScore: true });

export async function mapCategories(resolvedData, onProgress) {
  const { resolved } = resolvedData;
  onProgress?.(`Categorizing ${resolved.length} products...`);

  const categorized = [];
  const needsAI = [];

  for (let i = 0; i < resolved.length; i++) {
    const item = resolved[i];
    const result = localCategorize(item);

    if (result) {
      categorized.push({ ...item, category: result.category, subcategory: result.subCategory });
    } else {
      needsAI.push({ index: i, item });
    }
  }

  onProgress?.(`${categorized.length} mapped locally, ${needsAI.length} need AI categorization`);

  // Batch AI categorization (only if API is available)
  if (needsAI.length > 0 && isAPIAvailable()) {
    for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
      const batch = needsAI.slice(i, i + BATCH_SIZE);
      onProgress?.(`AI categorizing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(needsAI.length / BATCH_SIZE)}...`);

      try {
        const aiResult = await callClaudeJSON(
          CATEGORY_MAPPER_SYSTEM,
          categoryMapperUserPrompt(batch.map(b => b.item))
        );

        if (aiResult.categorized) {
          for (const cat of aiResult.categorized) {
            const batchItem = batch[cat.index];
            if (batchItem) {
              const item = batchItem.item;
              const validCategory = CATEGORY_NAMES.includes(cat.category) ? cat.category : 'Uncategorized';
              categorized.push({
                ...item,
                category: validCategory,
                subcategory: cat.subCategory || '',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Claude categorization unavailable, using local matching for remaining items');
        // Fallback: assign Uncategorized for this batch and skip further AI calls
        for (const { item } of batch) {
          categorized.push({ ...item, category: item.category || 'Uncategorized', subcategory: '' });
        }
        // Assign remaining needsAI items without AI
        for (let j = i + BATCH_SIZE; j < needsAI.length; j++) {
          const { item } = needsAI[j];
          categorized.push({ ...item, category: item.category || 'Uncategorized', subcategory: '' });
        }
        break;
      }
    }
  } else if (needsAI.length > 0) {
    onProgress?.(`AI unavailable — assigning ${needsAI.length} items as Uncategorized`);
    for (const { item } of needsAI) {
      categorized.push({ ...item, category: item.category || 'Uncategorized', subcategory: '' });
    }
  }

  // Fill in any items that might have been missed
  const processedIndices = new Set(categorized.map(c => c.upc));
  for (const item of resolved) {
    if (!processedIndices.has(item.upc)) {
      categorized.push({ ...item, category: item.category || 'Uncategorized', subcategory: item.subcategory || '' });
    }
  }

  onProgress?.(`Categorization complete: ${categorized.length} products`);

  return { categorized };
}

/**
 * Attempt local categorization using keyword matching.
 */
function localCategorize(item) {
  const searchText = [item.name, item.brand, item.category, item.size]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 1. Exact keyword match
  for (const [keyword, category] of keywordMap) {
    if (searchText.includes(keyword)) {
      const subCategory = guessSubCategory(category, searchText);
      return { category, subCategory };
    }
  }

  // 2. Fuzzy match on product name
  if (item.name) {
    const words = item.name.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      const results = fuse.search(word);
      if (results.length > 0 && results[0].score < 0.2) {
        const category = results[0].item.category;
        const subCategory = guessSubCategory(category, searchText);
        return { category, subCategory };
      }
    }
  }

  // 3. Check if existing category field maps to a store category
  if (item.category) {
    const existingCat = item.category.toLowerCase().trim();
    for (const catName of CATEGORY_NAMES) {
      if (existingCat.includes(catName.toLowerCase()) || catName.toLowerCase().includes(existingCat)) {
        const subCategory = guessSubCategory(catName, searchText);
        return { category: catName, subCategory };
      }
    }
  }

  return null; // Needs AI
}

function guessSubCategory(category, searchText) {
  const subs = STORE_CATEGORIES[category]?.subCategories || [];
  for (const sub of subs) {
    const subWords = sub.toLowerCase().split(/\s+/);
    if (subWords.some(w => w.length > 3 && searchText.includes(w))) {
      return sub;
    }
  }
  return subs[0] || '';
}
