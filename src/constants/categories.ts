import type { IngredientCategory } from '@/types/db';

/**
 * The 9 canonical ingredient categories (architecture §02 / business plan pantry
 * DB). Domain constants — labels/emoji come from the spec, not the design pass.
 * Order drives the Add Item category grid and the Pantry category sections.
 */
export interface CategoryMeta {
  key: IngredientCategory;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'fresh_produce', label: 'Fresh Produce', emoji: '🥬' },
  { key: 'meat_seafood', label: 'Meat & Seafood', emoji: '🥩' },
  { key: 'dairy', label: 'Dairy', emoji: '🧀' },
  { key: 'sauces', label: 'Sauces', emoji: '🍶' },
  { key: 'dry_staples', label: 'Dry Staples', emoji: '🍚' },
  { key: 'canned', label: 'Canned', emoji: '🥫' },
  { key: 'spices', label: 'Spices', emoji: '🧂' },
  { key: 'oils', label: 'Oils', emoji: '🫙' },
  { key: 'frozen', label: 'Frozen', emoji: '❄️' },
];

export const CATEGORY_LABEL: Record<IngredientCategory, string> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.key] = c.label;
    return acc;
  },
  {} as Record<IngredientCategory, string>
);

export const CATEGORY_ORDER: IngredientCategory[] = CATEGORIES.map((c) => c.key);
