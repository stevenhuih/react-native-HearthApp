import { supabase } from './supabase';
import type { Ingredient } from '@/types/db';

const INGREDIENT_COLUMNS =
  'id, name, category, default_unit, default_quantity, shopping_unit, shopping_qty_per_unit, default_shelf_life_days, track_quantity, aliases';

/**
 * The full canonical ingredient catalog (~211 eventually; ~47 seeded now).
 * Read-only, public SELECT under RLS. Cached client-side in the pantry store
 * after first load (§07: Add Item search is client-side over this list).
 */
export async function fetchAllIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_COLUMNS)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Ingredient[];
}
