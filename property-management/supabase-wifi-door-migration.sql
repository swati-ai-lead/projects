-- Run once in the Supabase SQL Editor after supabase-tenant-portal-migration.sql.
-- Adds WiFi details (global) and front door code (per tenant).

-- WiFi details stored in app_settings (already exists from parking migration)
insert into public.app_settings (key, value)
values
  ('wifi_ssid', ''),
  ('wifi_password', '')
on conflict (key) do nothing;

-- Front door code per tenant
alter table public.tenants add column if not exists front_door_code text;

-- No RLS changes needed: tenants table already has "Admins and linked tenants can read tenants" policy
-- which allows tenants to read their own record (including front_door_code).