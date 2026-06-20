-- 0008_creator_links.sql
-- creator_links: affiliate attribution. Edge-Function-write only.

create table public.creator_links (
  id               uuid primary key default gen_random_uuid(),
  creator_user_id  uuid not null references public.users (id) on delete cascade,
  recipe_id        uuid not null references public.recipes (id) on delete cascade,
  branch_link      text,
  click_count      integer not null default 0,
  conversion_count integer not null default 0,
  revenue_earned   numeric not null default 0   -- 20% of attributed subscription revenue
);

create index creator_links_creator_idx on public.creator_links (creator_user_id);

-- RLS: SELECT only, scoped to the creator. No client INSERT/UPDATE/DELETE —
-- links are generated exclusively via Edge Function (service role) to prevent
-- fabricated affiliate links (section 09).
alter table public.creator_links enable row level security;
create policy "creator_links_select_own" on public.creator_links
  for select to authenticated using (creator_user_id = auth.uid());
