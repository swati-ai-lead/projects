-- Run once in the Supabase SQL Editor.
insert into storage.buckets (id, name, public)
values ('leases', 'leases', false)
on conflict (id) do nothing;

create policy "Authenticated users can read lease files"
on storage.objects for select to authenticated
using (bucket_id = 'leases');

create policy "Only admin can upload lease files"
on storage.objects for insert to authenticated
with check (bucket_id = 'leases' and public.is_admin());

create policy "Only admin can update lease files"
on storage.objects for update to authenticated
using (bucket_id = 'leases' and public.is_admin())
with check (bucket_id = 'leases' and public.is_admin());

create policy "Only admin can delete lease files"
on storage.objects for delete to authenticated
using (bucket_id = 'leases' and public.is_admin());
