-- 0016_explore_realtime.sql
-- Explore tab (US-008, §06/§07): keep saved_recipes.pantry_match_pct current on
-- ANY pantry change, and stream those changes to the client via Realtime so the
-- Saved list re-sorts live.
--
-- §02 describes "pantry_items change → Edge Function recomputes pantry_match_pct".
-- We implement it as a Postgres trigger reusing the existing recompute_pantry_match()
-- (0012): deterministic, atomic with the pantry write, no network round-trip — and
-- it's what actually fires the Realtime UPDATE. (Until now only cook_logs INSERT
-- recomputed; a plain add/swipe/scan did not.)

-- Recompute every affected user's saved-recipe match %. Statement-level + a
-- transition table → one recompute per user per statement (so a 12-item receipt
-- batch recomputes once, not 12×). SECURITY DEFINER + empty search_path, matching
-- 0009/0012/0014. recompute_pantry_match() is SECURITY DEFINER and owned by the
-- same role, so the trigger can call it even though EXECUTE was revoked (0013).
create or replace function public.handle_pantry_match_recompute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  for uid in (select distinct user_id from affected) loop
    perform public.recompute_pantry_match(uid);
  end loop;
  return null;
end;
$$;

revoke execute on function public.handle_pantry_match_recompute() from public, anon, authenticated;

-- INSERT / UPDATE expose the new rows; DELETE exposes the old rows. user_id never
-- changes, so the new table is sufficient for INSERT/UPDATE.
create trigger pantry_items_recompute_insert
  after insert on public.pantry_items
  referencing new table as affected
  for each statement execute function public.handle_pantry_match_recompute();

create trigger pantry_items_recompute_update
  after update on public.pantry_items
  referencing new table as affected
  for each statement execute function public.handle_pantry_match_recompute();

create trigger pantry_items_recompute_delete
  after delete on public.pantry_items
  referencing old table as affected
  for each statement execute function public.handle_pantry_match_recompute();

-- Stream saved_recipes changes to the client. RLS (saved_recipes_select:
-- user_id = auth.uid()) already scopes what each subscriber receives; the client
-- also filters user_id=eq.<uid>. Default replica identity is enough — the client
-- only reads the new row's pantry_match_pct / missing_ingredients.
alter publication supabase_realtime add table public.saved_recipes;
