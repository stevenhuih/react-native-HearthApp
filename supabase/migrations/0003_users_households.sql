-- 0003_users_households.sql
-- Tier 1: users <-> households form a circular FK. We create users (with the
-- household_id column but no FK yet), create households (FK -> users), then
-- ALTER users to add the household_id FK.

-- ───────────────────────────────────────────────────────────── users
create table public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text,
  archetype_id        integer references public.pantry_archetypes (id),
  dietary_profile     jsonb not null
                        default '{"allergens":[],"restrictions":[],"cuisine_prefs":[]}'::jsonb,
  household_id        uuid,  -- FK added after households exists (see ALTER below)
  subscription_tier   text not null default 'free'
                        check (subscription_tier in ('free','plus','family')),
  revenuecat_id       text,
  onesignal_id        text,
  locale              text check (locale in ('en-SG','ja-JP','en-US')),
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────── households
create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_id     uuid not null references public.users (id) on delete cascade,
  invite_code  text not null unique check (char_length(invite_code) = 6),  -- 6-char unique
  member_limit integer not null default 5,
  created_at   timestamptz not null default now()
);

-- Close the circular reference.
alter table public.users
  add constraint users_household_id_fkey
  foreign key (household_id) references public.households (id) on delete set null;

-- Returns the household_id of the authenticated user. SECURITY DEFINER so RLS
-- policies can call it without recursing into the users table's own policies.
-- Defined here (not 0001) because its body references public.users.
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.users where id = auth.uid();
$$;

create index users_household_id_idx on public.users (household_id);
create index households_owner_id_idx on public.households (owner_id);

-- ─────────────────────────────────────────────────────── RLS: users
alter table public.users enable row level security;
create policy "users_select_own" on public.users
  for select to authenticated using (id = auth.uid());
create policy "users_insert_own" on public.users
  for insert to authenticated with check (id = auth.uid());
create policy "users_update_own" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users_delete_own" on public.users
  for delete to authenticated using (id = auth.uid());

-- ──────────────────────────────────────────────────── RLS: households
-- Members may read their own household; owner may update (add/remove members).
-- Households are created via the create-household Edge Function (service role),
-- so there is intentionally no client INSERT policy.
alter table public.households enable row level security;
create policy "households_select_members" on public.households
  for select to authenticated using (id = public.current_household_id());
create policy "households_update_owner" on public.households
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
