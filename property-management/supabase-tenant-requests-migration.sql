-- Run once in the Supabase SQL Editor after supabase-tenant-portal-migration.sql.
create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_name text not null,
  request_type text not null check (request_type in ('maintenance', 'lease_cancellation', 'parking')),
  category text,
  title text not null,
  detail text not null,
  status text not null check (status in ('Open', 'Priced', 'Resolved')) default 'Open',
  requested_date date not null default current_date,
  cost numeric(10,2) check (cost is null or cost >= 0),
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.tenant_requests enable row level security;

drop policy if exists "Authenticated users can read app settings" on public.app_settings;
create policy "Authenticated users can read app settings"
on public.app_settings for select to authenticated using (true);

drop policy if exists "Only admin can change app settings" on public.app_settings;
create policy "Only admin can change app settings"
on public.app_settings for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins and linked tenants can read tenant requests" on public.tenant_requests;
create policy "Admins and linked tenants can read tenant requests"
on public.tenant_requests for select to authenticated
using (public.is_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "Linked tenants can create tenant requests" on public.tenant_requests;
create policy "Linked tenants can create tenant requests"
on public.tenant_requests for insert to authenticated
with check (tenant_id = public.current_tenant_id());

drop policy if exists "Only admin can update tenant requests" on public.tenant_requests;
create policy "Only admin can update tenant requests"
on public.tenant_requests for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Only admin can delete tenant requests" on public.tenant_requests;
create policy "Only admin can delete tenant requests"
on public.tenant_requests for delete to authenticated
using (public.is_admin());

insert into public.app_settings (key, value)
values ('parking_terms', 'Parking requests are reviewed by the owner and may require an additional monthly charge, proof of vehicle registration, and compliance with property parking rules.')
on conflict (key) do nothing;