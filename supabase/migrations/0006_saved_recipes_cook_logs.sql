-- 0006_saved_recipes_cook_logs.sql
-- saved_recipes (personal Explore/Saved list) + cook_logs (completion events).

-- ──────────────────────────────────────────────────────── saved_recipes
create table public.saved_recipes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  recipe_id           uuid not null references public.recipes (id) on delete cascade,
  pantry_match_pct    numeric,
  missing_ingredients integer[] not null default '{}',   -- ingredient_ids not in pantry
  saved_at            timestamptz not null default now(),
  last_cooked_at      timestamptz
);

create index saved_recipes_user_match_idx on public.saved_recipes (user_id, pantry_match_pct desc);

-- RLS: strictly personal — not shared with household even on Family (section 09).
alter table public.saved_recipes enable row level security;
create policy "saved_recipes_select" on public.saved_recipes
  for select to authenticated using (user_id = auth.uid());
create policy "saved_recipes_insert" on public.saved_recipes
  for insert to authenticated with check (user_id = auth.uid());
create policy "saved_recipes_update" on public.saved_recipes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_recipes_delete" on public.saved_recipes
  for delete to authenticated using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────── cook_logs
create table public.cook_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users (id) on delete cascade,
  recipe_id            uuid not null references public.recipes (id) on delete cascade,
  servings_cooked      integer not null default 1,   -- defaults to recipe.servings (set by client/Edge fn)
  ingredients_deducted jsonb,    -- [{ingredient_id, qty_deducted, pantry_item_id}]
  items_rescued        integer not null default 0,
  waste_value_saved    numeric not null default 0,
  cooked_at            timestamptz not null default now()
);

create index cook_logs_user_id_idx on public.cook_logs (user_id);

-- RLS: SELECT + INSERT only. Cook logs are immutable events (section 09) —
-- no client UPDATE/DELETE. The INSERT is what fires the deduction trigger.
alter table public.cook_logs enable row level security;
create policy "cook_logs_select" on public.cook_logs
  for select to authenticated using (user_id = auth.uid());
create policy "cook_logs_insert" on public.cook_logs
  for insert to authenticated with check (user_id = auth.uid());
