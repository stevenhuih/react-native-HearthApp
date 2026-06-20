-- 0013_lock_down_cook_functions.sql
-- Address security advisors on the cook-trigger functions:
--  - pin convert_to_stock's search_path
--  - revoke EXECUTE so the helpers/trigger fn aren't exposed as PostgREST RPCs.
-- Safe: the trigger fires handle_cook_log as its definer (postgres), and its
-- internal calls run as the definer too, so no client EXECUTE grant is needed.

create or replace function public.convert_to_stock(qty numeric, recipe_unit text, stock_unit text)
returns numeric
language sql
immutable
set search_path = ''
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

revoke execute on function public.convert_to_stock(numeric, text, text) from public, anon, authenticated;
revoke execute on function public.recompute_pantry_match(uuid) from public, anon, authenticated;
revoke execute on function public.handle_cook_log() from public, anon, authenticated;
