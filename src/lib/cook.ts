import { supabase } from './supabase';

/**
 * Fire a cook completion. This is the ONLY thing the client does — the sacred
 * Postgres trigger (handle_cook_log) does all deduction, "used" marking,
 * waste_analytics, cook_count, and pantry_match recompute (AGENTS.md rule #5).
 * The client shows optimistic success and trusts the trigger.
 */
export async function logCook(recipeId: string, servings = 1): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { error } = await supabase.from('cook_logs').insert({
    user_id: user.id,
    recipe_id: recipeId,
    servings_cooked: servings,
  });
  if (error) throw error;
}
