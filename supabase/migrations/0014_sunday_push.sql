-- 0014_sunday_push.sql
-- Sunday push notification system (architecture §04 sunday-push-scheduler, US-007).
--
-- Adds two columns to public.users:
--   notification_prefs — per-user push settings. Sunday push is opt-out (default
--                        on); the Profile → Notification Settings toggle PATCHes
--                        this. RLS users_update_own already permits the write, so
--                        no new policy is needed.
--   last_scan_at       — timestamp of the user's most recent receipt/scan add.
--                        Drives the US-007 edge case "0 expiring items but hasn't
--                        scanned in 2+ weeks → gentle nudge". pantry_items has no
--                        created_at and its updated_at is refreshed by swipes, so
--                        a dedicated field is the only reliable signal.

alter table public.users
  add column notification_prefs jsonb not null default '{"sunday_push": true}'::jsonb,
  add column last_scan_at       timestamptz;

-- Keep users.last_scan_at current. Statement-level (one UPDATE per insert batch,
-- e.g. a 12-item receipt confirm) using a transition table. SECURITY DEFINER +
-- empty search_path, consistent with 0009/0012. Deterministic, zero AI.
create or replace function public.set_user_last_scan_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users u
     set last_scan_at = now()
  from (
    select distinct user_id
    from new_rows
    where add_method in ('receipt', 'scan')
  ) s
  where u.id = s.user_id;
  return null;
end;
$$;

create trigger pantry_items_set_last_scan_at
  after insert on public.pantry_items
  referencing new table as new_rows
  for each statement execute function public.set_user_last_scan_at();
