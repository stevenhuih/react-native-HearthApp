/**
 * Domain types.
 *
 * TODO(types): once the Supabase project is linked, generate these from the
 * schema with `supabase gen types typescript` and replace the hand-written
 * shapes below. Kept minimal for now — only what the auth/onboarding flow needs.
 */

export type SubscriptionTier = 'free' | 'plus' | 'family';

/** users.dietary_profile jsonb shape (architecture §02). */
export interface DietaryProfile {
  allergens: string[];
  restrictions: string[];
  cuisine_prefs: string[];
}

/** Subset of public.users the client reads for the auth gate. */
export interface UserProfile {
  id: string;
  display_name: string | null;
  archetype_id: number | null;
  dietary_profile: DietaryProfile;
  household_id: string | null;
  subscription_tier: SubscriptionTier;
  locale: string | null;
  onboarding_complete: boolean;
}

/** One pre-fill item inside pantry_archetypes.ingredient_seeds (architecture §02). */
export interface ArchetypeSeed {
  ingredient_id: number;
  quantity: number | null;
  unit: string;
  shelf_life_days: number | null;
}

export interface PantryArchetype {
  id: number;
  name: string;
  emoji: string | null;
  ingredient_seeds: ArchetypeSeed[];
}

/** Minimal ingredient shape for rendering archetype previews / confirm list. */
export interface IngredientRef {
  id: number;
  name: string;
  category: string;
}

export const EMPTY_DIETARY_PROFILE: DietaryProfile = {
  allergens: [],
  restrictions: [],
  cuisine_prefs: [],
};

// ── Pantry / ingredients (step 5) ───────────────────────────────────────────
/** Stock units — what the pantry tracks for deduction math (AGENTS.md rule #2). */
export type StockUnit = 'ml' | 'g' | 'count' | 'bunch';

export type IngredientCategory =
  | 'fresh_produce'
  | 'meat_seafood'
  | 'dairy'
  | 'sauces'
  | 'dry_staples'
  | 'canned'
  | 'spices'
  | 'oils'
  | 'frozen';

export type AddMethod = 'receipt' | 'archetype' | 'manual' | 'scan' | 'import';
export type PantryStatus = 'active' | 'used' | 'expired' | 'removed';

/** A canonical ingredient row. The ONLY thing a pantry item may reference — no
 * brands, no free text (AGENTS.md rule #1). */
export interface Ingredient {
  id: number;
  name: string;
  category: IngredientCategory;
  default_unit: StockUnit;
  default_quantity: number | null;
  shopping_unit: string | null; // purchase unit — used by the shopping list (later)
  shopping_qty_per_unit: number | null;
  default_shelf_life_days: number | null;
  track_quantity: boolean; // false for spices (existence only)
  aliases: string[];
}

/** Ingredient fields embedded in a pantry row via the PostgREST join. */
export interface PantryItemIngredient {
  id: number;
  name: string;
  category: IngredientCategory;
  default_unit: StockUnit;
  track_quantity: boolean;
}

export interface PantryItem {
  id: string;
  user_id: string;
  household_id: string | null;
  ingredient_id: number;
  quantity: number | null; // in default_unit (stock units)
  expires_at: string | null; // ISO date
  add_method: AddMethod;
  status: PantryStatus;
  updated_at: string;
  ingredient: PantryItemIngredient;
}
