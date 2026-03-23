/**
 * Inventory category mapping table.
 * Each category has a list of keywords/patterns for matching.
 */
export const STORE_CATEGORIES = {
  'Water': {
    subCategories: ['Still Water', 'Sparkling Water', 'Flavored Water', 'Coconut Water'],
    keywords: ['water', 'aqua', 'h2o', 'spring water', 'mineral water', 'sparkling water', 'coconut water', 'flavored water', 'dasani', 'aquafina', 'evian', 'fiji', 'smartwater', 'voss', 'perrier', 'la croix', 'lacroix', 'topo chico'],
  },
  'Soda': {
    subCategories: ['Cola', 'Lemon-Lime', 'Orange', 'Root Beer', 'Ginger Ale', 'Other Soda'],
    keywords: ['soda', 'cola', 'coke', 'pepsi', 'sprite', 'fanta', '7up', '7-up', 'dr pepper', 'mountain dew', 'root beer', 'ginger ale', 'cream soda', 'orange soda', 'grape soda', 'sierra mist', 'sunkist', 'crush', 'a&w', 'mug', 'barq', 'squirt', 'jarritos'],
  },
  'Beer': {
    subCategories: ['Domestic', 'Import', 'Craft', 'Light Beer', 'Non-Alcoholic Beer', 'Malt Liquor', 'Hard Seltzer', 'Hard Cider'],
    keywords: ['beer', 'lager', 'ale', 'ipa', 'stout', 'porter', 'pilsner', 'wheat beer', 'bud light', 'budweiser', 'miller', 'coors', 'corona', 'heineken', 'modelo', 'stella', 'blue moon', 'samuel adams', 'sierra nevada', 'hard seltzer', 'white claw', 'truly', 'hard cider', 'malt liquor', 'michelob', 'dos equis', 'pacifico', 'tecate', 'negra modelo'],
  },
  'Wine': {
    subCategories: ['Red Wine', 'White Wine', 'Rosé', 'Sparkling Wine', 'Champagne', 'Dessert Wine'],
    keywords: ['wine', 'cabernet', 'merlot', 'chardonnay', 'pinot', 'sauvignon', 'riesling', 'moscato', 'rosé', 'rose wine', 'champagne', 'prosecco', 'cava', 'port', 'sherry', 'sangria', 'zinfandel', 'malbec', 'syrah', 'shiraz', 'bordeaux', 'burgundy'],
  },
  'Spirits': {
    subCategories: ['Vodka', 'Whiskey', 'Rum', 'Tequila', 'Gin', 'Brandy', 'Liqueur', 'Ready-to-Drink'],
    keywords: ['vodka', 'whiskey', 'whisky', 'bourbon', 'rum', 'tequila', 'gin', 'brandy', 'cognac', 'liqueur', 'schnapps', 'mezcal', 'absinthe', 'scotch', 'hennessy', 'jack daniels', 'smirnoff', 'bacardi', 'captain morgan', 'patron', 'jose cuervo', 'jameson', 'fireball', 'jagermeister', 'baileys', 'kahlua'],
  },
  'Energy Drinks': {
    subCategories: ['Regular Energy', 'Sugar-Free Energy', 'Energy Shots', 'Performance Drinks'],
    keywords: ['energy drink', 'energy', 'red bull', 'monster', 'rockstar', 'bang', 'celsius', 'reign', 'c4', 'ghost energy', 'zoa', 'alani nu', '5-hour energy', 'energy shot', 'pre-workout', 'gfuel', 'g fuel', 'prime energy'],
  },
  'Candy & Snacks': {
    subCategories: ['Chocolate', 'Gummy Candy', 'Hard Candy', 'Chips', 'Nuts & Seeds', 'Cookies', 'Crackers', 'Jerky', 'Popcorn', 'Granola Bars'],
    keywords: ['candy', 'chocolate', 'gummy', 'gummies', 'chips', 'snack', 'cookie', 'cookies', 'cracker', 'jerky', 'popcorn', 'pretzel', 'nuts', 'trail mix', 'granola bar', 'protein bar', 'skittles', 'starburst', 'twix', 'snickers', "m&m", 'reese', 'kit kat', 'hershey', 'doritos', 'cheetos', 'lays', 'pringles', 'fritos', 'takis', 'funyuns', 'oreo', 'slim jim', 'beef jerky', 'sunflower seeds'],
  },
  'Tobacco': {
    subCategories: ['Cigarettes', 'Cigars', 'Vape', 'Smokeless Tobacco', 'Rolling Papers', 'Lighters'],
    keywords: ['tobacco', 'cigarette', 'cigar', 'vape', 'e-cigarette', 'nicotine', 'smokeless', 'chewing tobacco', 'snuff', 'rolling papers', 'lighter', 'marlboro', 'camel', 'newport', 'american spirit', 'swisher', 'juul', 'disposable vape', 'zyns', 'zyn'],
  },
  'Dairy': {
    subCategories: ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Cream', 'Eggs'],
    keywords: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs', 'dairy', 'half and half', 'cottage cheese', 'sour cream', 'cream cheese', 'whipped cream', 'oat milk', 'almond milk', 'soy milk', 'lactose free', 'eggnog'],
  },
  'Frozen': {
    subCategories: ['Ice Cream', 'Frozen Meals', 'Frozen Pizza', 'Frozen Snacks', 'Frozen Fruit'],
    keywords: ['frozen', 'ice cream', 'popsicle', 'frozen pizza', 'frozen meal', 'frozen dinner', 'frozen snack', 'frozen fruit', 'gelato', 'sorbet', 'frozen yogurt', 'freezer', 'hot pocket', 'lean cuisine', 'stouffers', 'digiorno', 'totino', 'bagel bites', 'corn dog', 'frozen burrito'],
  },
  'Hot Beverages': {
    subCategories: ['Coffee', 'Tea', 'Hot Chocolate', 'Cappuccino'],
    keywords: ['coffee', 'tea', 'hot chocolate', 'cocoa', 'cappuccino', 'latte', 'espresso', 'chai', 'matcha', 'green tea', 'black tea', 'herbal tea', 'k-cup', 'keurig', 'nescafe', 'folgers', 'starbucks coffee', 'dunkin coffee'],
  },
  'Prepared Foods': {
    subCategories: ['Sandwiches', 'Salads', 'Hot Dogs', 'Pizza Slices', 'Burritos', 'Soup'],
    keywords: ['sandwich', 'salad', 'hot dog', 'pizza slice', 'burrito', 'taco', 'soup', 'prepared food', 'deli', 'ready to eat', 'grab and go', 'meal', 'wrap', 'sub', 'roller grill', 'taquito', 'empanada'],
  },
  'Health & Beauty': {
    subCategories: ['Pain Relief', 'Cold & Flu', 'Vitamins', 'First Aid', 'Personal Care', 'Feminine Care'],
    keywords: ['medicine', 'pain relief', 'aspirin', 'ibuprofen', 'tylenol', 'advil', 'cold medicine', 'cough', 'vitamin', 'supplement', 'bandage', 'first aid', 'shampoo', 'conditioner', 'soap', 'deodorant', 'toothpaste', 'toothbrush', 'lotion', 'sunscreen', 'lip balm', 'chapstick', 'feminine', 'tampon', 'pad', 'condom'],
  },
  'General Merchandise': {
    subCategories: ['Phone Accessories', 'Batteries', 'Cleaning', 'Auto', 'Household', 'Pet'],
    keywords: ['charger', 'phone case', 'battery', 'batteries', 'cleaning', 'paper towel', 'toilet paper', 'trash bag', 'napkin', 'plate', 'cup', 'utensil', 'air freshener', 'motor oil', 'windshield', 'pet food', 'dog food', 'cat food', 'laundry', 'detergent', 'bleach', 'umbrella'],
  },
  'Ice': {
    subCategories: ['Bagged Ice', 'Dry Ice'],
    keywords: ['ice', 'bagged ice', 'ice bag', 'dry ice', 'ice cubes'],
  },
};

/**
 * Flat list of all category names for easy reference.
 */
export const CATEGORY_NAMES = Object.keys(STORE_CATEGORIES);

/**
 * Build a flat keyword → category lookup map.
 */
export function buildKeywordMap() {
  const map = new Map();
  for (const [category, data] of Object.entries(STORE_CATEGORIES)) {
    for (const keyword of data.keywords) {
      map.set(keyword.toLowerCase(), category);
    }
  }
  return map;
}

/**
 * Get sub-categories for a given category name.
 */
export function getSubCategories(category) {
  return STORE_CATEGORIES[category]?.subCategories || [];
}
