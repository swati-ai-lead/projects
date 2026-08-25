-- Run once in the Supabase SQL Editor after supabase-schema.sql.
create table public.rent_history (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  unit_id uuid not null references public.units(id) on delete cascade,
  unit_name text not null,
  rent numeric(10,2) not null check (rent >= 0),
  created_at timestamptz not null default now(),
  unique (month, unit_id)
);

create table public.utility_history (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  utility_id uuid not null references public.utilities(id) on delete cascade,
  service text not null,
  amount numeric(10,2) not null check (amount >= 0),
  due text not null,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (month, utility_id)
);

alter table public.rent_history enable row level security;
alter table public.utility_history enable row level security;
create policy "Authenticated users can read rent history" on public.rent_history for select to authenticated using (true);
create policy "Authenticated users can read utility history" on public.utility_history for select to authenticated using (true);
create policy "Only admin can change rent history" on public.rent_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Only admin can change utility history" on public.utility_history for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.rent_history (month, unit_id, unit_name, rent)
select date_trunc('month', current_date)::date, id, name, rent from public.units;

insert into public.utility_history (month, utility_id, service, amount, due, paid)
select date_trunc('month', current_date)::date, id, service, amount, due, paid from public.utilities;
