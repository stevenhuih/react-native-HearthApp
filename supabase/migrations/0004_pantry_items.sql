-- 0004_pantry_items.sql
-- Tier 2: the core table. FKs -> users, households, ingredients.

create table public.pantry_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  household_id  uuid references public.households (id) on delete set null,
  ingredient_id integer not null references public.ingredients (id),
  quantity      numeric,
  expires_at    date,
  added_by      uuid references public.users (id) on delete set null,
  add_method    text not null check (add_method in ('receipt','archetype','manual','scan','import')),
  status        text not null default 'active'
                  check (status in ('active','used','expired','removed')),
  -- Spec: "Computed: expires_at <= today+2". CURRENT_DATE is not IMMUTABLE, so
  -- this cannot be a Postgres generated column; it is a plain boolean kept
  -- current by the expiry logic / nightly cron (or computed client-side).
  is_red_zone   boolean not null default false,
  updated_at    timestamptz not null default now()
);

create index pantry_items_user_id_idx on public.pantry_items (user_id);
create index pantry_items_household_id_idx on public.pantry_items (household_id);
create index pantry_items_ingredient_id_idx on public.pantry_items (ingredient_id);
create index pantry_items_expires_at_idx on public.pantry_items (expires_at);

create trigger pantry_items_set_updated_at
  before update on public.pantry_items
  for each row execute function public.set_updated_at();

-- RLS: own items OR same household (section 09 / AGENTS.md).
alter table public.pantry_items enable row level security;
create policy "pantry_items_select" on public.pantry_items
  for select to authenticated
  using (user_id = auth.uid() or household_id = public.current_household_id());
create policy "pantry_items_insert" on public.pantry_items
  for insert to authenticated
  with check (user_id = auth.uid() or household_id = public.current_household_id());
create policy "pantry_items_update" on public.pantry_items
  for update to authenticated
  using (user_id = auth.uid() or household_id = public.current_household_id())
  with check (user_id = auth.uid() or household_id = public.current_household_id());
create policy "pantry_items_delete" on public.pantry_items
  for delete to authenticated
  using (user_id = auth.uid() or household_id = public.current_household_id());
