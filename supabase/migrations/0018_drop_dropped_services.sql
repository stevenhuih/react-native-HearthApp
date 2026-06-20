-- 0018_drop_dropped_services.sql
-- v2 migration step 2 (architecture v2 §03/§08): strip the dropped services.
--   OneSignal      -> removed (expo-notifications later)
--   Upstash/Sunday -> removed (the last_scan_at nudge signal is no longer needed)
--   Branch.io      -> removed/deferred (creator_links)
-- Removal only; the pantry/OCR/cook spine is untouched. The trigger dropped here
-- is the 0014 Sunday-push helper on pantry_items, NOT the cook-deduction trigger.

-- Sunday-push "weeks since last scan" signal (0014) — no longer used.
drop trigger if exists pantry_items_set_last_scan_at on public.pantry_items;
drop function if exists public.set_user_last_scan_at();

-- notification_prefs (Sunday on/off) is superseded by reminder_prefs (0017);
-- last_scan_at was only the Sunday nudge signal.
alter table public.users
  drop column if exists notification_prefs,
  drop column if exists last_scan_at;

-- Branch.io affiliate attribution — deferred in v2 (0 rows; nothing references it).
drop table if exists public.creator_links cascade;
