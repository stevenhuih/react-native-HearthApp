import { supabase } from './supabase';
import type { SavedRecipeCard } from '@/types/db';

// Saved recipes joined with their recipe (title / cook time). Highest pantry match
// first; ties (and the empty-pantry case where all are 0%) fall back to recency.
const SAVED_SELECT =
  'id, pantry_match_pct, missing_ingredients, saved_at, recipe:recipes(id, title, cook_time_mins)';

/** The current user's saved collection (US-008). RLS scopes it to the user. The
 *  v2 collections table holds both saved + imported; this is the saved sub-list. */
export async function fetchSavedRecipes(): Promise<SavedRecipeCard[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(SAVED_SELECT)
    .eq('collection_type', 'saved')
    .order('pantry_match_pct', { ascending: false, nullsFirst: false })
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SavedRecipeCard[];
}
