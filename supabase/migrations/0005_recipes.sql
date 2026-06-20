-- 0005_recipes.sql
-- recipes + recipe_ingredients (junction).

-- ───────────────────────────────────────────────────────────── recipes
create table public.recipes (
  id                 uuid primary key default gen_random_uuid(),
  created_by         uuid references public.users (id) on delete set null,  -- nullable for @hearth system recipes
  title              text not null,
  source_url         text,
  source_type        text check (source_type in (
                       'tiktok','youtube','instagram','web','manual','ai_generated')),
  instructions       jsonb,    -- [{step, text, duration_mins}]
  cook_time_mins     integer,
  servings           integer not null default 1,  -- ADDED (approved): cook_logs.servings_cooked defaults to this; recipe_ingredients.quantity is per 1 serving
  macros_per_serving jsonb,    -- {calories, protein_g, carbs_g, fat_g}
  is_community       boolean not null default false,
  cook_count         integer not null default 0   -- denormalised; trigger-maintained
);

create index recipes_created_by_idx on public.recipes (created_by);

-- RLS: community recipes are public-read; own recipes are owner-read.
-- INSERT only for authenticated as themselves. No client UPDATE/DELETE —
-- cook_count is maintained by the cook-completion trigger (section 09).
alter table public.recipes enable row level security;
create policy "recipes_select" on public.recipes
  for select to authenticated using (is_community = true or created_by = auth.uid());
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (created_by = auth.uid());

-- ──────────────────────────────────────────────────── recipe_ingredients
create table public.recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references public.recipes (id) on delete cascade,
  ingredient_id integer not null references public.ingredients (id),
  quantity      numeric,   -- amount needed for 1 serving
  unit          text check (unit in ('ml','g','count','tbsp','tsp','cup')),
  is_optional   boolean not null default false,
  notes         text
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);

-- RLS: inherits recipe access via the parent recipe.
alter table public.recipe_ingredients enable row level security;
create policy "recipe_ingredients_select" on public.recipe_ingredients
  for select to authenticated using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and (r.is_community = true or r.created_by = auth.uid())
    )
  );
create policy "recipe_ingredients_insert" on public.recipe_ingredients
  for insert to authenticated with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.created_by = auth.uid()
    )
  );
