-- Run once in the Supabase SQL Editor after supabase-history-migration.sql.
create table if not exists public.mortgage_schedule (
  id uuid primary key default gen_random_uuid(),
  effective_month date not null unique,
  amount numeric(10,2) not null check (amount >= 0),
  bill_document text,
  created_at timestamptz not null default now()
);

alter table public.mortgage_schedule enable row level security;

drop policy if exists "Authenticated users can read mortgage schedule" on public.mortgage_schedule;
create policy "Authenticated users can read mortgage schedule"
on public.mortgage_schedule for select to authenticated using (true);

drop policy if exists "Only admin can change mortgage schedule" on public.mortgage_schedule;
create policy "Only admin can change mortgage schedule"
on public.mortgage_schedule for all to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.utility_history add column if not exists bill_document text;
alter table public.expenses add column if not exists bill_document text;

insert into storage.buckets (id, name, public)
values ('bills', 'bills', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can read bill files" on storage.objects;
create policy "Authenticated users can read bill files"
on storage.objects for select to authenticated
using (bucket_id = 'bills');

drop policy if exists "Only admin can upload bill files" on storage.objects;
create policy "Only admin can upload bill files"
on storage.objects for insert to authenticated
with check (bucket_id = 'bills' and public.is_admin());

drop policy if exists "Only admin can update bill files" on storage.objects;
create policy "Only admin can update bill files"
on storage.objects for update to authenticated
using (bucket_id = 'bills' and public.is_admin())
with check (bucket_id = 'bills' and public.is_admin());

drop policy if exists "Only admin can delete bill files" on storage.objects;
create policy "Only admin can delete bill files"
on storage.objects for delete to authenticated
using (bucket_id = 'bills' and public.is_admin());

insert into public.mortgage_schedule (effective_month, amount)
select date_trunc('month', date)::date, amount
from public.expenses
where category = 'Mortgage'
on conflict (effective_month) do update set amount = excluded.amount;