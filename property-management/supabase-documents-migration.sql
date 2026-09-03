-- Run once in the Supabase SQL Editor after supabase-tenant-portal-migration.sql.
create table if not exists public.tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_type text not null check (document_type in ('lease')) default 'lease',
  title text not null,
  original_document text not null,
  signed_document text,
  lease_start date,
  lease_end date,
  status text not null check (status in ('Draft', 'Awaiting signature', 'Signed')) default 'Draft',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  signed_at timestamptz
);

alter table public.tenant_documents enable row level security;

drop policy if exists "Admins and linked tenants can read tenant documents" on public.tenant_documents;
create policy "Admins and linked tenants can read tenant documents"
on public.tenant_documents for select to authenticated
using (public.is_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "Only admin can create tenant documents" on public.tenant_documents;
create policy "Only admin can create tenant documents"
on public.tenant_documents for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins and linked tenants can update tenant documents" on public.tenant_documents;
create policy "Admins and linked tenants can update tenant documents"
on public.tenant_documents for update to authenticated
using (public.is_admin() or tenant_id = public.current_tenant_id())
with check (public.is_admin() or tenant_id = public.current_tenant_id());

drop policy if exists "Only admin can delete tenant documents" on public.tenant_documents;
create policy "Only admin can delete tenant documents"
on public.tenant_documents for delete to authenticated
using (public.is_admin());

drop policy if exists "Authenticated users can read lease files" on storage.objects;
create policy "Admins and linked tenants can read lease files"
on storage.objects for select to authenticated
using (
  bucket_id = 'leases'
  and (public.is_admin() or name like ('documents/' || public.current_tenant_id()::text || '/%'))
);

drop policy if exists "Linked tenants can upload signed lease files" on storage.objects;
create policy "Linked tenants can upload signed lease files"
on storage.objects for insert to authenticated
with check (bucket_id = 'leases' and name like ('documents/' || public.current_tenant_id()::text || '/signed/%'));