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

/** users.notification_prefs jsonb shape (migration 0014, US-007). Sunday push is
 *  opt-out (defaults on); the Profile → Notification Settings toggle persists it. */
export interface NotificationPrefs {
  sunday_push: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  sunday_push: true,
};

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
  notification_prefs: NotificationPrefs;
  last_scan_at: string | null; // ISO timestamp; null until first receipt/scan add
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

// ── Explore / recipes (step 11) ─────────────────────────────────────────────
/** Units a recipe ingredient may be expressed in (recipe_ingredients.unit). */
export type RecipeUnit = 'ml' | 'g' | 'count' | 'tbsp' | 'tsp' | 'cup';

/** One step inside recipes.instructions (jsonb). Shape varies by source — imported
 *  recipes use {step,text,duration_mins}; ai_generated use {n,text,mins} — so all
 *  positional fields are optional and normalised at render time. */
export interface RecipeInstructionStep {
  n?: number;
  step?: number;
  text: string;
  mins?: number | null;
  duration_mins?: number | null;
}

export interface RecipeMacros {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

/** recipes.origin — the v2 permission boundary (AGENTS.md rule #1). `user_import`
 *  and `ai_generated` are private to the owner and barred from public surfaces by
 *  RLS; `hearth_featured`/`community` can be public when `status = 'published'`. */
export type RecipeOrigin = 'hearth_featured' | 'community' | 'user_import' | 'ai_generated';
export type RecipeStatus = 'draft' | 'review' | 'published';
export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export interface Recipe {
  id: string;
  origin: RecipeOrigin;
  status: RecipeStatus;
  title: string;
  description: string | null;
  source_type: string | null;
  source_url: string | null;
  hero_image_url: string | null;
  cuisine_theme: string | null;
  difficulty: RecipeDifficulty | null;
  instructions: RecipeInstructionStep[] | null;
  cook_time_mins: number | null;
  servings: number; // recipe_ingredients.quantity is per 1 serving
  nutrition: RecipeMacros | null;
  like_count: number;
}

/** A recipe_ingredients row with its canonical ingredient embedded (PostgREST join). */
export interface RecipeIngredientRow {
  id: string;
  ingredient_id: number;
  quantity: number | null; // per 1 serving
  unit: RecipeUnit | null;
  is_optional: boolean;
  notes: string | null;
  ingredient: { id: number; name: string; default_unit: StockUnit; track_quantity: boolean };
}

/** A collections row (type=saved) joined with its recipe — one Saved card. */
export interface SavedRecipeCard {
  id: string;
  pantry_match_pct: number | null;
  missing_ingredients: number[]; // canonical ingredient_ids not in pantry
  saved_at: string;
  recipe: { id: string; title: string; cook_time_mins: number | null };
}

/** Per-ingredient pantry state on the Recipe Detail screen (§07). */
export type IngredientMatchStatus = 'have' | 'low' | 'missing';
