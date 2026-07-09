-- 0005_rls.sql — تفعيل RLS وسياساته

-- فعّل RLS على كل الجداول
alter table public.locales      enable row level security;
alter table public.taxonomies   enable row level security;
alter table public.projects     enable row level security;
alter table public.news         enable row level security;
alter table public.partners     enable row level security;
alter table public.stats        enable row level security;
alter table public.contact      enable row level security;
alter table public.pages        enable row level security;
alter table public.social_links enable row level security;
alter table public.leads        enable row level security;
alter table public.admins       enable row level security;

-- الطلبات: الزائر يضيف فقط؛ الأدمن يقرأ/يعدّل/يحذف
create policy "anon insert leads" on public.leads
  for insert to anon with check (true);
create policy "admin select leads" on public.leads
  for select to authenticated using (public.is_admin());
create policy "admin update leads" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete leads" on public.leads
  for delete to authenticated using (public.is_admin());

-- جداول المحتوى: الأدمن فقط (CRUD كامل)؛ لا وصول للزائر
do $$
declare t text;
begin
  foreach t in array array['locales','taxonomies','projects','news','partners','stats','contact','pages','social_links']
  loop
    execute format(
      'create policy "admin all %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin());',
      t
    );
  end loop;
end $$;

-- الأدمن: يقرأ صفّه فقط (وإدارة الجدول عبر service_role)
create policy "admin read own admin row" on public.admins
  for select to authenticated using (user_id = auth.uid());
