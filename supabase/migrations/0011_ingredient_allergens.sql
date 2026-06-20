-- 0011_ingredient_allergens.sql
-- Allergen tags on canonical ingredients, for server-side allergen validation
-- in AI features (AGENTS.md rule #7). Values use the same vocabulary as
-- users.dietary_profile.allergens (see src/constants/onboarding.ts):
--   peanuts | tree nuts | shellfish | fish | eggs | dairy | gluten | soy | sesame
-- The panic-button function rejects any recipe whose used ingredient's tags
-- intersect the user's allergens. Per-ingredient values are seeded in seed.sql.
alter table public.ingredients
  add column if not exists allergens text[] not null default '{}';
