-- Run this file once in the Supabase SQL Editor.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamptz not null default now()
);

create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when lower(new.email) = 'sushmit.gujar@gmail.com' then 'admin' else 'user' end);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and email = 'sushmit.gujar@gmail.com');
$$;

create table public.units (id uuid primary key default gen_random_uuid(), name text not null unique, tenant text, rent numeric(10,2) not null check (rent >= 0), paid boolean not null default false, received text);
create table public.maintenance (id uuid primary key default gen_random_uuid(), title text not null, unit text not null, detail text not null, priority text not null check (priority in ('Routine', 'Attention')), done boolean not null default false, created_at timestamptz not null default now());
create table public.utilities (id uuid primary key default gen_random_uuid(), service text not null unique, amount numeric(10,2) not null check (amount >= 0), due text not null, paid boolean not null default false);
create table public.expenses (id uuid primary key default gen_random_uuid(), date date not null, category text not null default 'Supplies', description text not null, amount numeric(10,2) not null check (amount >= 0));

alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.maintenance enable row level security;
alter table public.utilities enable row level security;
alter table public.expenses enable row level security;
create policy "Profiles are readable by their owner" on public.profiles for select using (auth.uid() = id);
create policy "Authenticated users can read property records" on public.units for select to authenticated using (true);
create policy "Authenticated users can read maintenance" on public.maintenance for select to authenticated using (true);
create policy "Authenticated users can read utilities" on public.utilities for select to authenticated using (true);
create policy "Authenticated users can read expenses" on public.expenses for select to authenticated using (true);
create policy "Only admin can change units" on public.units for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Only admin can change maintenance" on public.maintenance for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Only admin can change utilities" on public.utilities for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Only admin can change expenses" on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.units (name, tenant, rent) values ('Unit 1', 'Available to assign', 1200), ('Unit 2', 'Available to assign', 1350);
insert into public.maintenance (title, unit, detail, priority) values ('Seasonal walkthrough', 'Both units', 'Check smoke alarms, filters, and exterior entry points.', 'Routine'), ('Kitchen faucet', 'Unit 1', 'Tenant reported a slow drip at the base of the faucet.', 'Attention');
insert into public.utilities (service, amount, due, paid) values ('PECO', 164.82, 'Aug 28', false), ('WiFi', 69.99, 'Aug 22', true), ('Trash', 42.00, 'Sep 01', false), ('Sewer', 58.40, 'Sep 05', false), ('Water', 73.25, 'Sep 05', false);
insert into public.expenses (date, category, description, amount) values (current_date, 'Supplies', 'Initial property supplies', 0);