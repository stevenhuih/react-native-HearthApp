import { supabase } from './supabase';
import type {
  Ingredient,
  IngredientMatchStatus,
  PantryItem,
  Recipe,
  RecipeIngredientRow,
  RecipeUnit,
  StockUnit,
} from '@/types/db';

const RECIPE_COLUMNS =
  'id, origin, status, title, description, source_type, source_url, hero_image_url, ' +
  'cuisine_theme, difficulty, instructions, cook_time_mins, servings, nutrition, like_count';
const RECIPE_INGREDIENT_SELECT =
  'id, ingredient_id, quantity, unit, is_optional, notes, ingredient:ingredients(id, name, default_unit, track_quantity)';

export interface RecipeDetail {
  recipe: Recipe;
  ingredients: RecipeIngredientRow[];
}

/** Recipe + its ingredients (with canonical ingredient embedded) for the detail screen. */
export async function fetchRecipeDetail(recipeId: string): Promise<RecipeDetail> {
  const [recipeRes, ingredientsRes] = await Promise.all([
    supabase.from('recipes').select(RECIPE_COLUMNS).eq('id', recipeId).single(),
    supabase.from('recipe_ingredients').select(RECIPE_INGREDIENT_SELECT).eq('recipe_id', recipeId),
  ]);
  if (recipeRes.error) throw recipeRes.error;
  if (ingredientsRes.error) throw ingredientsRes.error;
  return {
    recipe: recipeRes.data as unknown as Recipe,
    ingredients: (ingredientsRes.data ?? []) as unknown as RecipeIngredientRow[],
  };
}

/** Client mirror of 0012's convert_to_stock: recipe unit → ingredient stock unit.
 *  Deterministic, zero-AI — used only to decide "low" vs "have" for display. */
export function convertToStock(qty: number, recipeUnit: RecipeUnit | null, stockUnit: StockUnit): number {
  if (recipeUnit == null || recipeUnit === stockUnit) return qty;
  if (stockUnit === 'ml' || stockUnit === 'g') {
    if (recipeUnit === 'tbsp') return qty * 15;
    if (recipeUnit === 'tsp') return qty * 5;
    if (recipeUnit === 'cup') return qty * 240;
  }
  return qty; // ml / g / count passthrough
}

/**
 * have / low / missing for one recipe ingredient against the live pantry (§07):
 *  - missing: not in the active pantry
 *  - have:    present and either untracked (spices), unknown qty, or sufficient
 *  - low:     present but the tracked quantity is below what the recipe needs
 */
export function classifyIngredient(
  pantry: PantryItem[],
  ri: RecipeIngredientRow,
  servings: number
): IngredientMatchStatus {
  const matches = pantry.filter((p) => p.ingredient_id === ri.ingredient_id && p.status === 'active');
  if (matches.length === 0) return 'missing';
  if (!ri.ingredient.track_quantity || ri.quantity == null) return 'have'; // existence is enough
  const haveQty = matches.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  if (haveQty <= 0) return 'have'; // present but qty untracked — don't false-flag as low
  const need = convertToStock(ri.quantity * servings, ri.unit, ri.ingredient.default_unit);
  return haveQty < need ? 'low' : 'have';
}

// TODO(design): smarter default when an ingredient has no shopping_unit configured.
const SHOPPING_UNIT_FALLBACK = 'pack';

/**
 * Add missing recipe ingredients to the shopping list in PURCHASE units (rule #2),
 * source 'recipe_missing' (§07). Phase 1: 1 purchase unit each — no qty math yet.
 */
export async function addMissingToShoppingList(
  ingredientIds: number[],
  catalog: Ingredient[]
): Promise<void> {
  if (ingredientIds.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const byId = new Map(catalog.map((i) => [i.id, i]));
  const rows = ingredientIds.map((id) => ({
    user_id: user.id,
    ingredient_id: id,
    quantity: 1, // purchase units, not stock units (rule #2)
    shopping_unit: byId.get(id)?.shopping_unit ?? SHOPPING_UNIT_FALLBACK,
    source: 'recipe_missing' as const,
  }));
  const { error } = await supabase.from('shopping_list_items').insert(rows);
  if (error) throw error;
}
