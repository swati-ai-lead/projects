-- Run once in the Supabase SQL Editor after supabase-schema.sql.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references public.units(id) on delete cascade,
  unit_name text not null,
  full_name text not null,
  email text,
  phone text,
  lease_start date not null,
  lease_end date not null,
  monthly_rent numeric(10,2) not null check (monthly_rent >= 0),
  status text not null check (status in ('Active', 'Upcoming', 'Ended')) default 'Active',
  created_at timestamptz not null default now(),
  check (lease_end >= lease_start)
);

alter table public.tenants enable row level security;
create policy "Authenticated users can read tenants" on public.tenants for select to authenticated using (true);
create policy "Only admin can change tenants" on public.tenants for all to authenticated using (public.is_admin()) with check (public.is_admin());
