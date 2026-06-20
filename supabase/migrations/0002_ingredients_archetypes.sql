-- 0002_ingredients_archetypes.sql
-- Tier 0: tables with no foreign-key dependencies.
-- ingredients = canonical DB (read-only to clients). pantry_archetypes = onboarding seeds.

-- ───────────────────────────────────────────────────────── ingredients
create table public.ingredients (
  id                      integer generated always as identity primary key,
  name                    text not null unique,            -- lowercase canonical
  category                text not null check (category in (
                            'fresh_produce','meat_seafood','dairy','sauces',
                            'dry_staples','canned','spices','oils','frozen')),
  default_unit            text not null check (default_unit in ('ml','g','count','bunch')),
  default_quantity        numeric,
  shopping_unit           text check (shopping_unit in (
                            'bottle','pack','bag','tray','jar','bunch','can')),
  shopping_qty_per_unit   numeric,
  default_shelf_life_days integer,
  track_quantity          boolean not null default true,   -- false for spices
  aliases                 text[] not null default '{}',
  search_keywords         tsvector
);

create index ingredients_category_idx on public.ingredients (category);
create index ingredients_search_idx on public.ingredients using gin (search_keywords);

alter table public.ingredients enable row level security;
-- Public read for any authenticated user. No write policies: canonical DB is
-- admin/service-role only (AGENTS.md rule #1).
create policy "ingredients_select_all" on public.ingredients
  for select to authenticated using (true);

-- ──────────────────────────────────────────────────── pantry_archetypes
create table public.pantry_archetypes (
  id               integer generated always as identity primary key,
  name             text not null,
  emoji            text,
  ingredient_seeds jsonb not null default '[]'::jsonb   -- [{ingredient_id, quantity, unit, shelf_life_days}]
);

alter table public.pantry_archetypes enable row level security;
create policy "pantry_archetypes_select_all" on public.pantry_archetypes
  for select to authenticated using (true);
