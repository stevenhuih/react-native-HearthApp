-- 0017_v2_recipe_origin_model.sql
-- v2 content-first pivot, migration step 1 (architecture v2 §08, schema-first).
-- Establishes the recipe ORIGIN MODEL and its RLS public/private boundary — the
-- single most important new rule: user_import / ai_generated recipes can never be
-- seen by anyone but their owner, enforced in the database, not the UI.
--
-- The pantry spine, OCR, and the cook-completion DEDUCTION LOOP are untouched. The
-- only change near the trigger is repointing the match-recompute + last_cooked_at
-- writes from saved_recipes -> collections (a table rename), preserving the loop.

-- ───────────────────────────────────────────────────────────── recipes
alter table public.recipes
  add column origin         text,
  add column status         text not null default 'published'
                              check (status in ('draft','review','published')),
  add column hero_image_url text,
  add column description    text,
  add column cuisine_theme  text,
  add column difficulty     text check (difficulty in ('easy','medium','hard')),
  add column like_count     integer not null default 0;

-- nutrition replaces the v1 macros_per_serving (same jsonb shape).
alter table public.recipes rename column macros_per_serving to nutrition;

-- Backfill origin conservatively (anything ambiguous -> private user_import).
update public.recipes set origin = case
  when source_type = 'ai_generated'                            then 'ai_generated'
  when source_type in ('tiktok','youtube','instagram','web')  then 'user_import'
  when source_url is not null                                 then 'user_import'
  when source_type = 'manual'                                 then 'community'
  else 'user_import'
end
where origin is null;

-- Community recipes are private (draft) until Phase 2 publishing; none exist today.
update public.recipes set status = 'draft' where origin = 'community';

alter table public.recipes
  alter column origin set not null,
  add constraint recipes_origin_check
    check (origin in ('hearth_featured','community','user_import','ai_generated'));

-- ──────────────────────────────────────────────── recipe_ingredients
-- Imports may carry ingredients that don't map to a canonical id — keep raw_text.
-- The cook trigger inner-joins ingredients, so null-id rows are skipped gracefully.
alter table public.recipe_ingredients
  alter column ingredient_id drop not null,
  add column raw_text text,
  add constraint recipe_ingredients_id_or_raw
    check (ingredient_id is not null or raw_text is not null);

-- ───────────────────────────────────────────────────────── recipe_steps
create table public.recipe_steps (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references public.recipes (id) on delete cascade,
  step_number     integer not null,
  instruction     text not null,
  step_image_url  text,
  timer_seconds   integer,
  video_timestamp integer
);
create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id, step_number);

alter table public.recipe_steps enable row level security;
create policy "recipe_steps_select" on public.recipe_steps
  for select to authenticated using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and ((r.origin in ('hearth_featured','community') and r.status = 'published')
             or r.created_by = auth.uid())
    )
  );
create policy "recipe_steps_insert" on public.recipe_steps
  for insert to authenticated with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.created_by = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────── likes
create table public.likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);
create index likes_recipe_id_idx on public.likes (recipe_id);

alter table public.likes enable row level security;
create policy "likes_select_own" on public.likes
  for select to authenticated using (user_id = auth.uid());
create policy "likes_insert_own" on public.likes
  for insert to authenticated with check (user_id = auth.uid());
create policy "likes_delete_own" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- Maintain the denormalised recipes.like_count. SECURITY DEFINER so a liker can
-- bump a recipe they don't own; search_path='' per 0009/0013.
create or replace function public.handle_like_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.recipes set like_count = like_count + 1 where id = new.recipe_id;
  elsif tg_op = 'DELETE' then
    update public.recipes set like_count = greatest(like_count - 1, 0) where id = old.recipe_id;
  end if;
  return null;
end;
$$;
revoke execute on function public.handle_like_change() from public, anon, authenticated;

create trigger likes_after_insert
  after insert on public.likes
  for each row execute function public.handle_like_change();
create trigger likes_after_delete
  after delete on public.likes
  for each row execute function public.handle_like_change();

-- ───────────────────────────────────────────────────────── import_jobs
create table public.import_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  source_url       text not null,
  status           text not null default 'queued'
                     check (status in ('queued','processing','done','failed')),
  result_recipe_id uuid references public.recipes (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index import_jobs_user_id_idx on public.import_jobs (user_id);

alter table public.import_jobs enable row level security;
create policy "import_jobs_select_own" on public.import_jobs
  for select to authenticated using (user_id = auth.uid());
create policy "import_jobs_insert_own" on public.import_jobs
  for insert to authenticated with check (user_id = auth.uid());
create policy "import_jobs_update_own" on public.import_jobs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ──────────────────────────────────── saved_recipes -> collections
-- 0 rows today; RLS policies and realtime publication membership follow the rename.
alter table public.saved_recipes rename to collections;
alter table public.collections
  add column collection_type text not null default 'saved'
    check (collection_type in ('saved','imported'));

-- Repoint the match-recompute helper to collections. Deduction logic lives in
-- handle_cook_log (below) and is unchanged. v2-correct: count only MAPPED,
-- NON-OPTIONAL ingredients so imports with raw_text rows don't deflate match %.
create or replace function public.recompute_pantry_match(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.collections sr
  set pantry_match_pct = sub.pct,
      missing_ingredients = sub.missing
  from (
    select
      sr2.id,
      round(100.0 * count(*) filter (where p.ingredient_id is not null) / count(*)) as pct,
      coalesce(
        array_agg(ri.ingredient_id) filter (where p.ingredient_id is null),
        '{}'::integer[]
      ) as missing
    from public.collections sr2
    join public.recipe_ingredients ri on ri.recipe_id = sr2.recipe_id
    left join (
      select distinct ingredient_id
      from public.pantry_items
      where user_id = p_user_id and status = 'active'
    ) p on p.ingredient_id = ri.ingredient_id
    where sr2.user_id = p_user_id
      and ri.ingredient_id is not null   -- v2: unmapped import rows don't count
      and ri.is_optional = false         -- v2: optional ingredients excluded
    group by sr2.id
  ) sub
  where sr.id = sub.id;
end;
$$;
revoke execute on function public.recompute_pantry_match(uuid) from public, anon, authenticated;

-- Repoint handle_cook_log's saved_recipes references to collections. The deduction
-- loop (steps 1-4) is preserved byte-for-byte from 0012 — only the table name in the
-- last_cooked_at write changes; the recompute call is unchanged.
create or replace function public.handle_cook_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ri record;
  pit record;
  need numeric;
  ded numeric;
  rescued integer := 0;
begin
  -- 1 + 2. Deduct each recipe ingredient FIFO by expiry; mark depleted as used.
  for ri in
    select r.ingredient_id, r.quantity, r.unit, ing.default_unit
    from public.recipe_ingredients r
    join public.ingredients ing on ing.id = r.ingredient_id
    where r.recipe_id = new.recipe_id
  loop
    if ri.quantity is null then
      continue;
    end if;
    need := public.convert_to_stock(ri.quantity * new.servings_cooked, ri.unit, ri.default_unit);
    if need is null or need <= 0 then
      continue;
    end if;

    for pit in
      select id, quantity, expires_at
      from public.pantry_items
      where user_id = new.user_id
        and ingredient_id = ri.ingredient_id
        and status = 'active'
      order by expires_at asc nulls last, id asc
    loop
      exit when need <= 0;
      if pit.quantity is null then
        continue; -- untracked (e.g. spices) — never deducted
      end if;
      ded := least(pit.quantity, need);
      need := need - ded;
      if pit.quantity - ded <= 0 then
        update public.pantry_items set quantity = 0, status = 'used' where id = pit.id;
        if pit.expires_at is null or pit.expires_at >= current_date then
          rescued := rescued + 1; -- used before it could go bad
        end if;
      else
        update public.pantry_items set quantity = pit.quantity - ded where id = pit.id;
      end if;
    end loop;
  end loop;

  -- 3. waste_analytics monthly counts.
  if rescued > 0 then
    insert into public.waste_analytics (user_id, period_month, items_rescued)
    values (new.user_id, date_trunc('month', current_date)::date, rescued)
    on conflict (user_id, period_month)
    do update set items_rescued = public.waste_analytics.items_rescued + excluded.items_rescued,
                  updated_at = now();
  end if;

  -- 4. cook_count.
  update public.recipes set cook_count = cook_count + 1 where id = new.recipe_id;

  -- 5. collections.last_cooked_at (renamed from saved_recipes; no-op if not saved).
  update public.collections
    set last_cooked_at = now()
    where user_id = new.user_id and recipe_id = new.recipe_id;

  -- 6. Recompute match % for the user's collections.
  perform public.recompute_pantry_match(new.user_id);

  return new;
end;
$$;
revoke execute on function public.handle_cook_log() from public, anon, authenticated;

-- ─────────────────────────────────── RLS: the recipe origin boundary
drop policy "recipes_select" on public.recipes;
drop policy "recipes_insert_own" on public.recipes;

-- Public sees only published featured/community; owners see their own of any origin.
-- user_import / ai_generated are therefore NEVER visible to non-owners.
create policy "recipes_select" on public.recipes
  for select to authenticated using (
    (origin in ('hearth_featured','community') and status = 'published')
    or created_by = auth.uid()
  );

-- Clients can create only their own private/own-origin recipes — never hearth_featured
-- (admin/service-role only), never a self-published community recipe (Phase 2).
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (
    created_by = auth.uid()
    and origin in ('user_import','ai_generated','community')
    and (origin <> 'community' or status <> 'published')
  );

-- origin is immutable: a user_import can never be promoted to community/featured.
create or replace function public.enforce_recipe_origin_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.origin is distinct from old.origin then
    raise exception 'recipe origin is immutable (% -> %)', old.origin, new.origin;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_recipe_origin_immutable() from public, anon, authenticated;

create trigger recipes_origin_immutable
  before update on public.recipes
  for each row execute function public.enforce_recipe_origin_immutable();

-- recipe_ingredients visibility inherited is_community; repoint it to the origin
-- model so the column can be dropped (and so private imports' ingredients stay private).
drop policy "recipe_ingredients_select" on public.recipe_ingredients;
create policy "recipe_ingredients_select" on public.recipe_ingredients
  for select to authenticated using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and ((r.origin in ('hearth_featured','community') and r.status = 'published')
             or r.created_by = auth.uid())
    )
  );

-- origin supersedes is_community; nothing references it anymore.
alter table public.recipes drop column is_community;

-- ───────────────────────────────────────────────────────────── users
alter table public.users
  add column reminder_prefs jsonb not null default '{"enabled": false}'::jsonb,
  add column avatar_url     text;
