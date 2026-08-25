-- Run once after supabase-tenants-migration.sql.
alter table public.tenants add column if not exists lease_document text;

insert into public.tenants (
  unit_id, unit_name, full_name, lease_start, lease_end,
  monthly_rent, status, lease_document
)
select
  id,
  name,
  'Mohammed Asif Shahrier',
  date '2026-10-01',
  date '2027-10-30',
  850.00,
  'Upcoming',
  '/Lease%20Agreeement%20Asif%20Oct%202026%20to%20Oct%202027.pdf'
from public.units
where name = 'Unit 2'
on conflict (unit_id) do update set
  unit_name = excluded.unit_name,
  full_name = excluded.full_name,
  lease_start = excluded.lease_start,
  lease_end = excluded.lease_end,
  monthly_rent = excluded.monthly_rent,
  status = excluded.status,
  lease_document = excluded.lease_document;

update public.units
set tenant = 'Mohammed Asif Shahrier'
where name = 'Unit 2';
