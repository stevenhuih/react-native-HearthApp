-- 0007_shopping_waste.sql
-- shopping_list_items (smart list in purchase units) + waste_analytics (monthly aggregates).

-- ─────────────────────────────────────────────────── shopping_list_items
create table public.shopping_list_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  ingredient_id integer not null references public.ingredients (id),
  quantity      numeric,    -- in shopping_unit (not pantry unit)
  shopping_unit text check (shopping_unit in (
                  'bottle','pack','bag','tray','jar','bunch','can')),  -- denormalised from ingredients
  source        text check (source in ('auto_reorder','recipe_missing','manual')),
  is_checked    boolean not null default false,
  added_at      timestamptz not null default now()
);

create index shopping_list_items_user_id_idx on public.shopping_list_items (user_id);

-- RLS: personal list (AGENTS.md: user_id = auth.uid()). Household shopping sync
-- is a Family-tier concern handled later (build step 14); kept personal here.
alter table public.shopping_list_items enable row level security;
create policy "shopping_list_items_select" on public.shopping_list_items
  for select to authenticated using (user_id = auth.uid());
create policy "shopping_list_items_insert" on public.shopping_list_items
  for insert to authenticated with check (user_id = auth.uid());
create policy "shopping_list_items_update" on public.shopping_list_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shopping_list_items_delete" on public.shopping_list_items
  for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────────────────────────────────────── waste_analytics
create table public.waste_analytics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  period_month      date not null,   -- first day of month
  items_rescued     integer not null default 0,
  items_expired     integer not null default 0,
  waste_value_saved numeric not null default 0,
  co2_kg_saved      numeric not null default 0,
  updated_at        timestamptz not null default now(),
  unique (user_id, period_month)
);

-- RLS: SELECT + UPDATE only for the owner. No client INSERT/DELETE — rows are
-- written by the cook-completion trigger and the nightly cron (service role,
-- which bypasses RLS). Section 09 + AGENTS.md: no direct client write.
alter table public.waste_analytics enable row level security;
create policy "waste_analytics_select" on public.waste_analytics
  for select to authenticated using (user_id = auth.uid());
create policy "waste_analytics_update" on public.waste_analytics
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
