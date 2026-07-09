-- 0006_storage.sql — bucket الصور: قراءة عامة، كتابة للأدمن فقط
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');

create policy "admin insert media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

create policy "admin update media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());

create policy "admin delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
