-- Run once in the Supabase SQL Editor after supabase-tenants-migration.sql.
alter table public.profiles
add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  linked_tenant_id uuid;
begin
  if lower(new.email) = 'tenantuser123@1179bush.local' then
    select id into linked_tenant_id
    from public.tenants
    where status <> 'Ended'
    order by unit_name
    limit 1;
  end if;

  insert into public.profiles (id, email, role, tenant_id)
  values (new.id, new.email, case when lower(new.email) = 'sushmit.gujar@gmail.com' then 'admin' else 'user' end, linked_tenant_id);
  return new;
end;
$$;

update public.profiles
set tenant_id = (
  select id from public.tenants
  where status <> 'Ended'
  order by unit_name
  limit 1
)
where lower(email) = 'tenantuser123@1179bush.local'
  and tenant_id is null;

drop policy if exists "Authenticated users can read property records" on public.units;
create policy "Admins and linked tenants can read units"
on public.units for select to authenticated
using (public.is_admin() or id in (select unit_id from public.tenants where id = public.current_tenant_id()));

drop policy if exists "Authenticated users can read tenants" on public.tenants;
create policy "Admins and linked tenants can read tenants"
on public.tenants for select to authenticated
using (public.is_admin() or id = public.current_tenant_id());

drop policy if exists "Authenticated users can read rent history" on public.rent_history;
create policy "Admins and linked tenants can read rent history"
on public.rent_history for select to authenticated
using (public.is_admin() or unit_id in (select unit_id from public.tenants where id = public.current_tenant_id()));

drop policy if exists "Authenticated users can read expenses" on public.expenses;
create policy "Admins and linked tenants can read expenses"
on public.expenses for select to authenticated
using (
  public.is_admin()
  or allocation = 'all_tenants'
  or public.current_tenant_id() = any(tenant_ids)
);

drop policy if exists "Authenticated users can read mortgage schedule" on public.mortgage_schedule;
create policy "Only admins can read mortgage schedule"
on public.mortgage_schedule for select to authenticated
using (public.is_admin());