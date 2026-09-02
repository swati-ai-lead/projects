-- Run once in the Supabase SQL Editor after supabase-owner-bills-migration.sql.
alter table public.expenses
add column if not exists allocation text not null default 'owner'
check (allocation in ('owner', 'all_tenants', 'selected_tenants'));

alter table public.expenses
add column if not exists tenant_ids uuid[] not null default '{}';

update public.expenses
set allocation = 'owner', tenant_ids = '{}'
where allocation is null;