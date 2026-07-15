-- 0006 — Storage bucket cho ảnh bìa lớp (public read, staff write).
insert into storage.buckets (id, name, public)
values ('class-covers', 'class-covers', true)
on conflict (id) do nothing;

create policy "class_covers_public_read" on storage.objects
  for select using (bucket_id = 'class-covers');

create policy "class_covers_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'class-covers');

create policy "class_covers_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'class-covers');

create policy "class_covers_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'class-covers');
