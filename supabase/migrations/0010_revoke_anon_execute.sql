-- 0010_revoke_anon_execute.sql
-- Supabase grants EXECUTE on public functions to `anon` explicitly (not only via
-- PUBLIC), so 0009's `revoke ... from public` didn't remove anon's access to the
-- RLS helper. Remove it explicitly. Safe: every RLS policy is `to authenticated`,
-- so `anon` never needs to evaluate current_household_id().
revoke execute on function public.current_household_id() from anon;
