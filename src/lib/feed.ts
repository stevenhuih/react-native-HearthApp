import { supabase } from './supabase';
import type { FeedRecipe, RecipeDifficulty } from '@/types/db';

// The Home feed is ONLY Hearth-featured, published recipes. This origin/status
// filter is defense-in-depth with the RLS bar (AGENTS.md rule #1): a user_import /
// ai_generated recipe can NEVER reach a public surface. NEVER widen this filter.
const FEED_SELECT =
  'id, title, cuisine_theme, cook_time_mins, difficulty, hero_image_url, like_count, likes(id)';

interface FeedRow {
  id: string;
  title: string;
  cuisine_theme: string | null;
  cook_time_mins: number | null;
  difficulty: RecipeDifficulty | null;
  hero_image_url: string | null;
  like_count: number;
  likes: { id: string }[] | null;
}

/**
 * The Home feed (US-V2-01). `like_count` desc is the ranking signal. The embedded
 * `likes` is RLS-scoped to the current user (likes_select_own), so it returns 0 or 1
 * row per card — yielding the per-card liked state in a single query. Browsing the
 * feed costs zero AI (rule #9).
 */
export async function fetchFeed(): Promise<FeedRecipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(FEED_SELECT)
    .eq('origin', 'hearth_featured')
    .eq('status', 'published')
    .order('like_count', { ascending: false })
    .order('id');
  if (error) throw error;
  return ((data ?? []) as unknown as FeedRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    cuisine_theme: r.cuisine_theme,
    cook_time_mins: r.cook_time_mins,
    difficulty: r.difficulty,
    hero_image_url: r.hero_image_url,
    like_count: r.like_count,
    liked: (r.likes?.length ?? 0) > 0,
  }));
}

/** Like a recipe. The handle_like_change trigger maintains recipes.like_count — the
 *  client only writes the likes row and shows optimistic UI (never sets like_count). */
export async function likeRecipe(recipeId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { error } = await supabase.from('likes').insert({ user_id: user.id, recipe_id: recipeId });
  if (error) throw error;
}

/** Remove the current user's like. */
export async function unlikeRecipe(recipeId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id);
  if (error) throw error;
}
