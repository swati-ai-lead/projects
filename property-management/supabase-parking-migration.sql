-- Run once in the Supabase SQL Editor after supabase-tenant-requests-migration.sql.
create table if not exists public.parking_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location text not null default 'Driveway spot',
  monthly_amount numeric(10,2) not null default 100 check (monthly_amount >= 0),
  start_month date not null default date_trunc('month', current_date)::date,
  end_month date,
  active boolean not null default true,
  terms text not null default '',
  created_at timestamptz not null default now(),
  check (end_month is null or end_month >= start_month)
);

create unique index if not exists one_active_driveway_assignment
on public.parking_assignments ((lower(location)))
where active and lower(location) = 'driveway spot';

alter table public.parking_assignments enable row level security;

drop policy if exists "Admins and linked tenants can read parking assignments" on public.parking_assignments;
create policy "Admins and linked tenants can read parking assignments"
on public.parking_assignments for select to authenticated
using (public.is_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "Only admin can change parking assignments" on public.parking_assignments;
create policy "Only admin can change parking assignments"
on public.parking_assignments for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.app_settings (key, value)
values
  ('parking_location', 'Driveway spot behind 1179 Bush St. Park only in the assigned driveway space and keep garage access clear.'),
  ('parking_monthly_amount', '100'),
  ('parking_terms', 'Parking is limited to one driveway spot total and one spot per tenant. The default charge is $100 per month once approved by the owner. If parked on the driveway, snow removal is the tenant responsibility. Snow must be properly disposed on the side, not in front of the garage.')
on conflict (key) do update set value = excluded.value, updated_at = now();