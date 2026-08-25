-- Run once after supabase-history-migration.sql.
-- Adds cash-payment status to each monthly rent snapshot.
alter table public.rent_history add column if not exists paid boolean not null default false;
alter table public.rent_history add column if not exists received text;

-- Seed the current month from the existing unit records without overwriting any saved history.
insert into public.rent_history (month, unit_id, unit_name, rent, paid, received)
select date_trunc('month', current_date)::date, id, name, rent, paid, received
from public.units
on conflict (month, unit_id) do nothing;
