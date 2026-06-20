-- 0009_harden_functions.sql
-- Address Supabase security-advisor warnings on the helper functions.
-- (Migrations are immutable once applied, so this corrects 0001/0003 rather
-- than editing them.)

-- Pin an empty search_path on the updated_at trigger fn. It only touches NEW
-- and now() (pg_catalog), so an empty search_path is safe.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- current_household_id() is a SECURITY DEFINER helper meant to be called only
-- inside RLS policies (which run as `authenticated`). Keep EXECUTE for
-- authenticated — revoking it would break the pantry_items/households policies
-- — but drop it from the default PUBLIC grant so `anon` can't invoke it as an
-- RPC. (Signed-in users can still call it; it only returns their own
-- household_id, which is not sensitive.)
revoke execute on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated;
