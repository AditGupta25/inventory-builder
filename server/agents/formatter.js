import { callClaudeJSON } from '../utils/claudeClient.js';
import { FORMATTER_SYSTEM, formatterUserPrompt } from '../prompts/agentPrompts.js';

/**
 * Agent 5 — Inventory Formatter
 * Transforms data into exact inventory template format.
 */

const BATCH_SIZE = 50;

export async function formatInventory(categoryData, onProgress) {
  const { categorized } = categoryData;
  onProgress?.(`Formatting ${categorized.length} products for inventory template...`);

  const allClean = [];
  const allFlagged = [];

  // Process in batches
  for (let i = 0; i < categorized.length; i += BATCH_SIZE) {
    const batch = categorized.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(categorized.length / BATCH_SIZE);
    onProgress?.(`Formatting batch ${batchNum}/${totalBatches}...`);

    // Try local formatting first, use Claude for complex cases
    const { clean, flagged, needsAI } = localFormat(batch);
    allClean.push(...clean);
    allFlagged.push(...flagged);

    if (needsAI.length > 0) {
      try {
        const aiResult = await callClaudeJSON(
          FORMATTER_SYSTEM,
          formatterUserPrompt(needsAI),
          { maxTokens: 8192 }
        );
        if (aiResult.clean) allClean.push(...aiResult.clean);
        if (aiResult.flagged) allFlagged.push(...aiResult.flagged);
      } catch (err) {
        console.warn('Claude formatting failed, using local fallback:', err.message);
        // Local fallback: format as best we can, flag all
        for (const item of needsAI) {
          allFlagged.push(formatSingleItem(item, 'AI formatting unavailable'));
        }
      }
    }
  }

  onProgress?.(`Formatted ${allClean.length} clean + ${allFlagged.length} flagged items`);

  return { clean: allClean, flagged: allFlagged };
}

function localFormat(items) {
  const clean = [];
  const flagged = [];
  const needsAI = [];

  for (const item of items) {
    const flags = [];

    // Check for flag conditions
    if (!item.upc || item.upc.length < 6) {
      flags.push({ flag: 'Suspicious UPC', detail: `UPC "${item.upc}" is less than 6 digits` });
    }

    const price = parseFloat(item.price) || 0;
    if (price <= 0) {
      flags.push({ flag: 'Invalid price', detail: `Price is ${price}` });
    } else if (price > 999) {
      flags.push({ flag: 'High price', detail: `Price $${price} exceeds $999` });
    }

    if (!item.name || item.name.trim() === '') {
      flags.push({ flag: 'Missing name', detail: 'Product has no name' });
    }

    const { size, unit } = parseSize(item.size || item.name || '');
    if (!size && item.size) {
      flags.push({ flag: 'Unparseable size', detail: `Could not parse size from "${item.size}"` });
    }

    // Format the item
    const formatted = {
      upc: String(item.upc || '').padStart(1, '0'),
      name: formatProductName(item),
      category: item.category || 'Uncategorized',
      subCategory: item.subcategory || '',
      images: '',
      sizeDescription: size || item.size || '',
      unitOfMeasure: unit || 'ea',
      storePrice: Math.round(price * 100) / 100,
    };

    if (flags.length > 0) {
      flagged.push({
        ...formatted,
        flag: flags.map(f => f.flag).join('; '),
        flagDetail: flags.map(f => f.detail).join('; '),
      });
    } else {
      clean.push(formatted);
    }
  }

  return { clean, flagged, needsAI };
}

function formatSingleItem(item, flagReason) {
  const price = parseFloat(item.price) || 0;
  const { size, unit } = parseSize(item.size || '');
  return {
    upc: String(item.upc || ''),
    name: formatProductName(item),
    category: item.category || 'Uncategorized',
    subCategory: item.subcategory || '',
    images: '',
    sizeDescription: size || item.size || '',
    unitOfMeasure: unit || 'ea',
    storePrice: Math.round(price * 100) / 100,
    flag: flagReason,
    flagDetail: flagReason,
  };
}

function formatProductName(item) {
  const parts = [item.brand, item.name].filter(Boolean);
  let name = parts.join(' ').trim();

  if (!name) return 'Unknown Product';

  // Title case
  name = name.replace(/\b\w+/g, word => {
    if (word.length <= 2) return word.toUpperCase(); // OZ, ML, etc.
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return name;
}

/**
 * Parse size and unit from strings like "12oz", "1 LITER", "6PK/12OZ", "500ml"
 */
function parseSize(str) {
  if (!str) return { size: '', unit: '' };

  const s = String(str).trim();

  // Match patterns like "12oz", "1.5L", "6pk/12oz", "500 ml", "12 fl oz"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/i,     // fluid ounces
    /(\d+(?:\.\d+)?)\s*ml/i,                    // milliliters
    /(\d+(?:\.\d+)?)\s*l(?:iter)?s?/i,          // liters
    /(\d+(?:\.\d+)?)\s*gal(?:lon)?s?/i,         // gallons
    /(\d+(?:\.\d+)?)\s*lb/i,                     // pounds
    /(\d+(?:\.\d+)?)\s*(?:g|grams?)/i,          // grams
    /(\d+(?:\.\d+)?)\s*kg/i,                     // kilograms
    /(\d+)\s*(?:pk|pack)/i,                      // packs
    /(\d+)\s*(?:ct|count)/i,                     // count
  ];

  const unitMap = [
    'oz', 'ml', 'L', 'gal', 'lb', 'g', 'kg', 'pk', 'ct',
  ];

  // Check for pack format first: "6PK/12OZ" → "6pk/12oz"
  const packMatch = s.match(/(\d+)\s*(?:pk|pack)[\s/]*(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/i);
  if (packMatch) {
    return { size: `${packMatch[1]}pk/${packMatch[2]}oz`, unit: 'pk' };
  }

  for (let i = 0; i < patterns.length; i++) {
    const match = s.match(patterns[i]);
    if (match) {
      return { size: `${match[1]}${unitMap[i]}`, unit: unitMap[i] };
    }
  }

  // No pattern matched — return raw string
  return { size: s, unit: 'ea' };
}
