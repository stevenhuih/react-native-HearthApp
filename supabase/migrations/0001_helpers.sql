-- 0001_helpers.sql
-- Shared extensions and functions used across later migrations.
-- This file defines NO tables, columns, or fields.

create extension if not exists pgcrypto;  -- provides gen_random_uuid()

-- Keeps a row's updated_at current. Attached only to tables whose spec
-- (section 02) states updated_at is "auto-updated trigger on every change"
-- — i.e. pantry_items.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NOTE: current_household_id() depends on public.users, so it is defined in
-- 0003 (after that table exists) rather than here.
