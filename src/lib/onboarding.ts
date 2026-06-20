import { supabase } from './supabase';
import type { ArchetypeSeed, DietaryProfile, IngredientRef, PantryArchetype } from '@/types/db';

/** Read-only archetype catalog for onboarding Step 2 (public SELECT, RLS). */
export async function fetchArchetypes(): Promise<PantryArchetype[]> {
  const { data, error } = await supabase
    .from('pantry_archetypes')
    .select('id, name, emoji, ingredient_seeds')
    .order('id');
  if (error) throw error;
  return (data ?? []) as PantryArchetype[];
}

/** Resolve ingredient_ids (from archetype seeds) to names for preview/confirm UI. */
export async function fetchIngredientsByIds(ids: number[]): Promise<IngredientRef[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, category')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as IngredientRef[];
}

export interface CompleteOnboardingInput {
  archetypeId: number | null;
  /** ingredient_ids the user kept from the archetype confirm step. */
  confirmedItemIds: number[];
  dietaryProfile: DietaryProfile;
  /** Seeds for the chosen archetype, used by the future Edge Function to fill the pantry. */
  seeds: ArchetypeSeed[];
}

/**
 * Finalizes onboarding.
 *
 * TODO(edge): replace this body with a call to the `complete-onboarding` Edge
 * Function (build step 8), which must, server-side:
 *   1. batch INSERT pantry_items from `seeds` filtered to `confirmedItemIds`
 *      (add_method = 'archetype'),
 *   2. set users.dietary_profile + archetype_id + onboarding_complete = true,
 *   3. send the welcome email via Resend.
 *
 * For now (build step 4, structure only) we set the profile + flag client-side
 * so the auth gate works end-to-end. Pantry seeding + email are deferred —
 * `seeds`/`confirmedItemIds` are accepted here so the call site is already shaped
 * for the Edge Function and nothing needs to change later.
 */
export async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { error } = await supabase
    .from('users')
    .update({
      archetype_id: input.archetypeId,
      dietary_profile: input.dietaryProfile,
      onboarding_complete: true,
    })
    .eq('id', user.id);
  if (error) throw error;
}
