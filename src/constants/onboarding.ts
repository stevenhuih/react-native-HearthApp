/**
 * Onboarding Step 3 (Dietary Profile) option lists.
 *
 * These are profile tags stored in users.dietary_profile (allergens /
 * restrictions / cuisine_prefs) — NOT canonical ingredients. Allergens are an
 * absolute safety constraint downstream (AGENTS.md rule #7), so the allergen
 * list must stay accurate.
 *
 * TODO(content): finalize the exact option sets with product/design.
 */

export const ALLERGEN_OPTIONS = [
  'peanuts',
  'tree nuts',
  'shellfish',
  'fish',
  'eggs',
  'dairy',
  'gluten',
  'soy',
  'sesame',
] as const;

export const RESTRICTION_OPTIONS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'gluten-free',
  'dairy-free',
  'low-carb',
  'high-protein',
] as const;

export const CUISINE_OPTIONS = [
  'asian',
  'italian',
  'mediterranean',
  'mexican',
  'indian',
  'american',
] as const;

/** Total onboarding steps — drives the progress bar (US-001: exactly 4). */
export const ONBOARDING_STEP_COUNT = 4;
