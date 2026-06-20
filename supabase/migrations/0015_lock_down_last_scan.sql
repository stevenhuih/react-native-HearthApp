-- 0015_lock_down_last_scan.sql
-- Address the security advisor on 0014's trigger function, mirroring 0013.
-- set_user_last_scan_at() is only ever fired by the pantry_items AFTER INSERT
-- trigger, which runs the function as its definer (postgres) — no client EXECUTE
-- grant is needed. Revoke it so it isn't exposed as a PostgREST RPC.
revoke execute on function public.set_user_last_scan_at() from public, anon, authenticated;
