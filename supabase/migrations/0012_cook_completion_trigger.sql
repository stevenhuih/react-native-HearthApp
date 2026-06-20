-- 0012_cook_completion_trigger.sql
-- The sacred cook-completion trigger (AGENTS.md rule #5 / architecture §04).
-- A cook_logs INSERT deducts pantry quantities (FIFO by expiry), marks depleted
-- items used, bumps waste_analytics counts, increments recipes.cook_count,
-- updates saved_recipes.last_cooked_at, and recomputes pantry_match_pct.
--
-- All functions are SECURITY DEFINER so they can perform the privileged writes
-- the client is not allowed to do directly (waste_analytics, cook_count). The
-- client only INSERTs cook_logs (RLS) and never replicates this logic.

-- Convert a recipe unit to the ingredient's stock unit for deduction.
-- Volume conversions are exact; g <-> volume uses a density-1 approximation
-- (the consumption model self-corrects across cook cycles).
create or replace function public.convert_to_stock(qty numeric, recipe_unit text, stock_unit text)
returns numeric
language sql
immutable
as $$
  select case
    when qty is null then null
    when recipe_unit is null or recipe_unit = stock_unit then qty
    when stock_unit = 'ml' and recipe_unit = 'tbsp' then qty * 15
    when stock_unit = 'ml' and recipe_unit = 'tsp'  then qty * 5
    when stock_unit = 'ml' and recipe_unit = 'cup'  then qty * 240
    when stock_unit = 'g'  and recipe_unit = 'tbsp' then qty * 15
    when stock_unit = 'g'  and recipe_unit = 'tsp'  then qty * 5
    when stock_unit = 'g'  and recipe_unit = 'cup'  then qty * 240
    when recipe_unit in ('ml', 'g', 'count') then qty
    else qty
  end;
$$;

-- Recompute pantry_match_pct + missing_ingredients for all of a user's saved
-- recipes. Reusable (a pantry_items-change trigger will also call this later).
create or replace function public.recompute_pantry_match(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.saved_recipes sr
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
    from public.saved_recipes sr2
    join public.recipe_ingredients ri on ri.recipe_id = sr2.recipe_id
    left join (
      select distinct ingredient_id
      from public.pantry_items
      where user_id = p_user_id and status = 'active'
    ) p on p.ingredient_id = ri.ingredient_id
    where sr2.user_id = p_user_id
    group by sr2.id
  ) sub
  where sr.id = sub.id;
end;
$$;

-- The trigger body.
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

  -- 3. waste_analytics monthly counts (value/CO2 are computed later by the
  --    analytics cron, which has the price/emission tables — step 12).
  if rescued > 0 then
    insert into public.waste_analytics (user_id, period_month, items_rescued)
    values (new.user_id, date_trunc('month', current_date)::date, rescued)
    on conflict (user_id, period_month)
    do update set items_rescued = public.waste_analytics.items_rescued + excluded.items_rescued,
                  updated_at = now();
  end if;

  -- 4. cook_count.
  update public.recipes set cook_count = cook_count + 1 where id = new.recipe_id;

  -- 5. saved_recipes.last_cooked_at (no-op if this recipe isn't saved).
  update public.saved_recipes
    set last_cooked_at = now()
    where user_id = new.user_id and recipe_id = new.recipe_id;

  -- 6. Recompute match % for the user's saved recipes.
  perform public.recompute_pantry_match(new.user_id);

  return new;
end;
$$;

create trigger cook_logs_after_insert
  after insert on public.cook_logs
  for each row execute function public.handle_cook_log();
