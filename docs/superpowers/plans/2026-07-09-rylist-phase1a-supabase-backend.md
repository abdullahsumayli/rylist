# RYLIST — خطة تنفيذ المرحلة ١أ: خلفية Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** بناء خلفية Supabase الكاملة لـRYLIST — جداول متعدّدة المحليّات، سياسات RLS آمنة، تخزين صور، وبيانات أولية — كمصدر واحد للحقيقة تعتمد عليه لوحة التحكم والموقع العام.

**Architecture:** Postgres على Supabase المستضاف. الحقول القابلة للترجمة تُخزَّن كـ`jsonb` مفاتيحه رموز اللغات (locale-driven) فتصير إضافة لغة = مفتاح جديد بلا تغيير مخطّط. RLS يمنع القراءة العامة للمحتوى (الموقع ثابت يقرأ من ملفات مُولَّدة) ويسمح فقط بـ`INSERT` للطلبات من الزائر. الهجرات تُطبَّق وتُختبَر عبر أدوات Supabase MCP وتُحفظ كملفات SQL.

**Tech Stack:** Supabase (Postgres 15 + Auth + Storage) · SQL · أدوات MCP `mcp__supabase-samaile__*` (`list_projects`, `apply_migration`, `execute_sql`, `list_tables`, `get_advisors`) · Node/npm (لتثبيت Supabase CLI اختياريًا).

> **مرجع التصميم:** [docs/superpowers/specs/2026-07-09-rylist-admin-cms-design.md](../specs/2026-07-09-rylist-admin-cms-design.md) — الأقسام ٤ (البيانات) و٥ (الأمان) و٦ (التخزين).
> **موضع هذه الخطة:** خطة ١ من ٣ للمرحلة ١. اللاحقتان: (ب) لوحة التحكم، (ج) الموقع العام + بايبلاين النشر. كلاهما يعتمد على هذه.

> **أسلوب TDD هنا:** «الاختبار» = استعلام تحقّق عبر `execute_sql` يرفع استثناءً عند الفشل. نشغّله أولًا فيفشل (الجدول غير موجود)، نطبّق الهجرة، نعيد التشغيل فينجح. كل هجرة تُحفظ كملف تحت `supabase/migrations/` **و** تُطبَّق عبر `apply_migration`.

---

### Task 0: التهيئة والمشروع

**Files:**
- Create: `supabase/.gitkeep`
- Create: `supabase/config.notes.md`

- [ ] **Step 1: تأكّد من وجود مشروع Supabase (أو أنشئه)**

استخدم أداة MCP: `mcp__supabase-samaile__list_projects`.
- إن وُجد مشروع مخصّص لـRYLIST، سجّل `project_id` و`project ref`.
- إن لم يوجد، أنشئه من لوحة Supabase (`app.supabase.com` → New project) باسم `rylist`، منطقة قريبة (مثل `eu-central-1`)، واحفظ كلمة مرور قاعدة البيانات في مدير أسرار (لا تكتبها في الريبو).

- [ ] **Step 2: أنشئ مجلد الهجرات وملاحظات الإعداد**

```bash
mkdir -p supabase/migrations
printf "" > supabase/.gitkeep
```

اكتب `supabase/config.notes.md` (بيانات غير سرّية فقط):

```markdown
# إعداد Supabase — RYLIST
- project ref: <ref هنا>
- المفتاح المنشور (anon/publishable): يُستخدم في المتصفّح (لوحة + موقع) — غير سرّي، RLS يحمي.
- المفتاح service_role: سرّ Vercel فقط (للبناء). لا يُكتب في الريبو أبدًا.
- ANTHROPIC_API_KEY: سرّ Supabase (للمراحل ٢–٤).
- الهجرات: ملفات SQL تحت supabase/migrations/ ، تُطبَّق عبر MCP apply_migration.
```

- [ ] **Step 3: تأكّد أن `.env` و`service_role` مستثناة في .gitignore**

الملف [.gitignore](../../../.gitignore) يستثني `.env` و`.env.*` أصلاً. تحقّق فقط بصريًّا أن السطور موجودة. لا تضف أي مفتاح للريبو.

- [ ] **Step 4: Commit**

```bash
git add supabase/.gitkeep supabase/config.notes.md
git commit -m "chore: scaffold supabase project structure"
```

---

### Task 1: الجداول المرجعية (locales + taxonomies)

**Files:**
- Create: `supabase/migrations/0001_reference_tables.sql`

- [ ] **Step 1: اكتب استعلام التحقّق (الاختبار) وشغّله — يجب أن يفشل**

عبر `mcp__supabase-samaile__execute_sql` نفّذ:

```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='locales') as has_locales,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='taxonomies') as has_taxonomies;
```

Expected: صفّ يرجع `has_locales = 0` و`has_taxonomies = 0` (الجداول غير موجودة بعد).

- [ ] **Step 2: اكتب ملف الهجرة**

`supabase/migrations/0001_reference_tables.sql`:

```sql
-- 0001_reference_tables.sql — locales + taxonomies

create table if not exists public.locales (
  code       text primary key,
  name       text not null,
  dir        text not null check (dir in ('rtl','ltr')),
  enabled    boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.taxonomies (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('city','property_type')),
  key        text not null,
  i18n       jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  unique (kind, key)
);

-- بذور اللغات (الصيني معطّل حتى يجهز محتواه)
insert into public.locales (code, name, dir, enabled, sort_order) values
  ('ar','العربية','rtl', true, 1),
  ('en','English','ltr', true, 2),
  ('zh','中文','ltr', false, 3)
on conflict (code) do nothing;
```

- [ ] **Step 3: طبّق الهجرة**

استخدم `mcp__supabase-samaile__apply_migration` مع `name = "0001_reference_tables"` و`query` = محتوى الملف أعلاه.

- [ ] **Step 4: أعِد استعلام التحقّق — يجب أن ينجح**

نفّذ نفس استعلام Step 1 عبر `execute_sql`.
Expected: `has_locales = 1` و`has_taxonomies = 1`.

ثم تحقّق من بذور اللغات:

```sql
select code, enabled from public.locales order by sort_order;
```
Expected: 3 صفوف — `ar`(t), `en`(t), `zh`(f).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_reference_tables.sql
git commit -m "feat(db): add locales and taxonomies reference tables"
```

---

### Task 2: جداول المحتوى + مُحفّز updated_at

**Files:**
- Create: `supabase/migrations/0002_content_tables.sql`

- [ ] **Step 1: اكتب استعلام التحقّق وشغّله — يجب أن يفشل**

```sql
select count(*) as content_tables
from information_schema.tables
where table_schema='public'
  and table_name in ('projects','news','partners','stats','contact','pages','social_links');
```
Expected: `content_tables = 0`.

- [ ] **Step 2: اكتب ملف الهجرة**

`supabase/migrations/0002_content_tables.sql`:

```sql
-- 0002_content_tables.sql — جداول المحتوى + محفّز updated_at

-- دالة تحديث updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- العقارات
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  city_key    text not null,
  type_key    text not null,
  status      text not null default 'available' check (status in ('available','sold')),
  sold        int  not null default 0 check (sold between 0 and 100),
  price_min   bigint,
  price_max   bigint,
  area        text,
  beds_min    int,
  beds_max    int,
  featured    boolean not null default false,
  sort_order  int not null default 0,
  image_url   text,
  i18n        jsonb not null default '{}'::jsonb,  -- { title:{ar,en,zh}, district:{...}, description:{...} }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();

-- الأخبار/المدونة
create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  image_url    text,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  i18n         jsonb not null default '{}'::jsonb,  -- { title:{...}, excerpt:{...}, body:{...} }
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_news_updated before update on public.news
  for each row execute function public.set_updated_at();

-- الشركاء
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  logo_url   text,
  sort_order int not null default 0,
  i18n       jsonb not null default '{}'::jsonb   -- { name:{...} }
);

-- الأرقام/الإحصائيات
create table if not exists public.stats (
  id         uuid primary key default gen_random_uuid(),
  value      numeric not null default 0,
  suffix     text,
  sort_order int not null default 0,
  i18n       jsonb not null default '{}'::jsonb   -- { label:{...} }
);

-- التواصل (صف واحد)
create table if not exists public.contact (
  id       int primary key default 1 check (id = 1),
  whatsapp text,
  email    text,
  phone    text,
  map_url  text,
  i18n     jsonb not null default '{}'::jsonb    -- { address:{...}, hours:{...} }
);

-- الصفحات الثابتة (من نحن / الخدمات)
create table if not exists public.pages (
  key  text primary key check (key in ('about','services')),
  i18n jsonb not null default '{}'::jsonb        -- { title:{...}, body:{...} } (body = HTML/نص غني)
);

-- روابط السوشيال ميديا
create table if not exists public.social_links (
  id         uuid primary key default gen_random_uuid(),
  platform   text not null check (platform in ('instagram','x','tiktok','snapchat','linkedin','youtube','facebook')),
  url        text not null,
  enabled    boolean not null default true,
  sort_order int not null default 0
);
```

- [ ] **Step 3: طبّق الهجرة**

`apply_migration` مع `name = "0002_content_tables"`.

- [ ] **Step 4: أعِد استعلام التحقّق — يجب أن ينجح**

نفّذ استعلام Step 1. Expected: `content_tables = 7`.

تحقّق من المحفّز:
```sql
select count(*) as triggers from information_schema.triggers
where trigger_name in ('trg_projects_updated','trg_news_updated');
```
Expected: `triggers = 2`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_content_tables.sql
git commit -m "feat(db): add content tables (projects, news, partners, stats, contact, pages, social_links)"
```

---

### Task 3: جدول الطلبات (leads)

**Files:**
- Create: `supabase/migrations/0003_leads.sql`

- [ ] **Step 1: اكتب استعلام التحقّق وشغّله — يجب أن يفشل**

```sql
select count(*) as has_leads from information_schema.tables
where table_schema='public' and table_name='leads';
```
Expected: `has_leads = 0`.

- [ ] **Step 2: اكتب ملف الهجرة**

`supabase/migrations/0003_leads.sql`:

```sql
-- 0003_leads.sql — الطلبات الواردة
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  phone        text,
  email        text,
  project_code text,
  message      text,
  source       text not null default 'form' check (source in ('form','chat')),
  status       text not null default 'new'  check (status in ('new','contacted','closed')),
  locale       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_leads_created_at on public.leads (created_at desc);
create index if not exists idx_leads_status on public.leads (status);
```

- [ ] **Step 3: طبّق الهجرة** — `apply_migration` مع `name = "0003_leads"`.

- [ ] **Step 4: أعِد التحقّق — يجب أن ينجح**

استعلام Step 1. Expected: `has_leads = 1`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_leads.sql
git commit -m "feat(db): add leads table with source/status/locale"
```

---

### Task 4: الأدمن ودالة is_admin()

**Files:**
- Create: `supabase/migrations/0004_admins.sql`

- [ ] **Step 1: اكتب استعلام التحقّق وشغّله — يجب أن يفشل**

```sql
select count(*) as has_fn from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='is_admin';
```
Expected: `has_fn = 0`.

- [ ] **Step 2: اكتب ملف الهجرة**

`supabase/migrations/0004_admins.sql`:

```sql
-- 0004_admins.sql — قائمة سماح الأدمن + دالة مساعدة
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
```

- [ ] **Step 3: طبّق الهجرة** — `apply_migration` مع `name = "0004_admins"`.

- [ ] **Step 4: أعِد التحقّق — يجب أن ينجح**

استعلام Step 1. Expected: `has_fn = 1`. وتأكّد أن الجدول موجود:
```sql
select count(*) from information_schema.tables where table_schema='public' and table_name='admins';
```
Expected: `1`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_admins.sql
git commit -m "feat(db): add admins allowlist and is_admin() helper"
```

---

### Task 5: سياسات RLS (الأهم أمنيًّا)

**Files:**
- Create: `supabase/migrations/0005_rls.sql`
- Create: `supabase/tests/rls_checks.sql`

- [ ] **Step 1: اكتب اختبار سلوك RLS وشغّله — يجب أن يفشل (لأن RLS غير مفعّل بعد)**

احفظ `supabase/tests/rls_checks.sql` ونفّذ محتواه عبر `execute_sql`:

```sql
-- rls_checks.sql — يتحقّق أن الزائر (anon) يضيف طلبًا فقط، ولا يقرأ المحتوى
do $$
declare cnt int;
begin
  -- محاكاة دور الزائر
  set local role anon;

  -- (١) الزائر يقدر يضيف طلبًا
  insert into public.leads (name, phone, source) values ('rls-test','000','form');

  -- (٢) الزائر لا يقرأ العقارات (RLS يرجّع صفر صفوف)
  select count(*) into cnt from public.projects;
  if cnt <> 0 then
    raise exception 'FAIL: anon can read projects (expected 0, got %)', cnt;
  end if;

  -- (٣) الزائر لا يقرأ الطلبات
  select count(*) into cnt from public.leads;
  if cnt <> 0 then
    raise exception 'FAIL: anon can read leads (expected 0, got %)', cnt;
  end if;

  reset role;
  raise notice 'PASS: anon insert-only behavior holds';
end $$;
```

Expected (قبل الهجرة): يفشل عند التحقّق (٢) لأن RLS غير مفعّل فالزائر يقرأ العقارات → `FAIL: anon can read projects`. (نظّف صف الاختبار: `delete from public.leads where name='rls-test';` بدور مميّز.)

- [ ] **Step 2: اكتب ملف الهجرة**

`supabase/migrations/0005_rls.sql`:

```sql
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
```

> ملاحظة: الموقع العام لا يقرأ من هذه الجداول وقت التشغيل (يقرأ من `data.js` المُولَّد)؛ القارئ الوحيد للمحتوى هو سكربت البناء بمفتاح `service_role` الذي يتخطّى RLS. لذلك لا نحتاج سياسة قراءة للزائر.

- [ ] **Step 3: طبّق الهجرة** — `apply_migration` مع `name = "0005_rls"`.

- [ ] **Step 4: أعِد تشغيل اختبار RLS — يجب أن ينجح**

نفّذ `supabase/tests/rls_checks.sql` عبر `execute_sql`.
Expected: بلا استثناء، وإشعار `PASS: anon insert-only behavior holds`.

ثم نظّف صفوف الاختبار (بدور مميّز/الافتراضي):
```sql
delete from public.leads where name = 'rls-test';
```

- [ ] **Step 5: تحقّق من محقّق الأمان في Supabase**

استخدم `mcp__supabase-samaile__get_advisors` بنوع `security`.
Expected: لا تحذيرات «RLS disabled on public table». إن ظهر جدول بلا RLS، أضِف `alter table ... enable row level security;` وأعِد التطبيق.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_rls.sql supabase/tests/rls_checks.sql
git commit -m "feat(db): enable RLS — anon insert-only leads, admin-only content"
```

---

### Task 6: تخزين الصور (bucket media)

**Files:**
- Create: `supabase/migrations/0006_storage.sql`

- [ ] **Step 1: اكتب استعلام التحقّق وشغّله — يجب أن يفشل**

```sql
select count(*) as has_media from storage.buckets where id = 'media';
```
Expected: `has_media = 0`.

- [ ] **Step 2: اكتب ملف الهجرة**

`supabase/migrations/0006_storage.sql`:

```sql
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
```

- [ ] **Step 3: طبّق الهجرة** — `apply_migration` مع `name = "0006_storage"`.

- [ ] **Step 4: أعِد التحقّق — يجب أن ينجح**

استعلام Step 1. Expected: `has_media = 1`. وتأكّد أنه عام:
```sql
select public from storage.buckets where id='media';
```
Expected: `true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_storage.sql
git commit -m "feat(storage): add public media bucket with admin-only writes"
```

---

### Task 7: البيانات الأولية (seed) من data.js

**Files:**
- Create: `supabase/migrations/0007_seed.sql`

> نقل المحتوى الحالي من [assets/js/data.js](../../../assets/js/data.js). الأمثلة أدناه صفوف **حقيقية** من data.js؛ أكمل بقية العقارات/الأخبار بنفس التطابق الحرفي للأعمدة.

- [ ] **Step 1: اكتب استعلام التحقّق وشغّله — يجب أن يفشل**

```sql
select
  (select count(*) from public.taxonomies) as tax,
  (select count(*) from public.projects)   as proj,
  (select count(*) from public.contact)    as contact;
```
Expected: `tax = 0`, `proj = 0`, `contact = 0`.

- [ ] **Step 2: اكتب ملف البذور**

`supabase/migrations/0007_seed.sql`:

```sql
-- 0007_seed.sql — بيانات أولية منقولة من data.js

-- التصنيفات: المدن وأنواع العقار
insert into public.taxonomies (kind, key, i18n, sort_order) values
  ('city','riyadh', '{"label":{"ar":"الرياض","en":"Riyadh","zh":"利雅得"}}', 1),
  ('property_type','villa',     '{"label":{"ar":"فلل","en":"Villas","zh":"别墅"}}', 1),
  ('property_type','apartment', '{"label":{"ar":"شقق","en":"Apartments","zh":"公寓"}}', 2),
  ('property_type','townhouse', '{"label":{"ar":"تاون هاوس","en":"Townhouses","zh":"联排别墅"}}', 3)
on conflict (kind, key) do nothing;

-- التواصل (من CONTACT في data.js) — استبدل الـplaceholders بالقيم الحقيقية قبل الإطلاق
insert into public.contact (id, whatsapp, email, phone, map_url, i18n) values (
  1,
  '9665XXXXXXXX',
  'hello@rylist.sa',
  '+966 11 000 0000',
  'https://www.google.com/maps?q=24.7136,46.6753&output=embed',
  '{"address":{"ar":"الرياض، المملكة العربية السعودية","en":"Riyadh, Saudi Arabia","zh":"沙特阿拉伯，利雅得"},"hours":{"ar":"الأحد – الخميس · ٩ص – ٦م","en":"Sun – Thu · 9am – 6pm","zh":"周日至周四 · 上午9点 - 下午6点"}}'
) on conflict (id) do nothing;

-- العقارات (أول ٣ من PROJECTS في data.js — أكمل الباقي بنفس الشكل)
insert into public.projects
  (code, city_key, type_key, status, sold, price_min, price_max, area, beds_min, beds_max, featured, sort_order, image_url, i18n)
values
  ('RY-1042','riyadh','villa','available',62,2400000,3900000,'320–520',4,6,true,1,
   'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"قمم الملقا","en":"Malqa Peaks","zh":""},"district":{"ar":"الملقا","en":"Al Malqa","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1043','riyadh','apartment','available',47,900000,1600000,'120–210',2,4,true,2,
   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"واجهة النرجس","en":"Narjis Front","zh":""},"district":{"ar":"النرجس","en":"Al Narjis","zh":""},"description":{"ar":"","en":"","zh":""}}'),
  ('RY-1044','riyadh','townhouse','available',78,1800000,2600000,'240–300',3,5,true,3,
   'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=70',
   '{"title":{"ar":"أروقة حطين","en":"Hittin Arcades","zh":""},"district":{"ar":"حطين","en":"Hittin","zh":""},"description":{"ar":"","en":"","zh":""}}')
on conflict (code) do nothing;

-- الصفحات الثابتة (فارغة الآن، يملؤها الأدمن لاحقًا)
insert into public.pages (key, i18n) values
  ('about',    '{"title":{"ar":"من نحن","en":"About","zh":""},"body":{"ar":"","en":"","zh":""}}'),
  ('services', '{"title":{"ar":"الخدمات","en":"Services","zh":""},"body":{"ar":"","en":"","zh":""}}')
on conflict (key) do nothing;
```

> **إكمال البذور:** افتح [assets/js/data.js](../../../assets/js/data.js) وانقل بقية عناصر `PROJECTS` و`STATS` و`PARTNERS` و`NEWS` بنفس تطابق الأعمدة أعلاه: كل `titleAr/titleEn` → `i18n.title.ar/en`، `districtAr/En` → `i18n.district`، `img` → `image_url` (الرابط الكامل = `IMG + <id> + q`)، إلخ. اترك `zh` فارغًا (يُملأ عند تجهيز الصيني). صفوف `STATS`: `value/suffix` أعمدة، و`labelAr/En` → `i18n.label`. `PARTNERS`: `nameAr/En` → `i18n.name`، `logo` → `logo_url`. `NEWS`: `titleAr/En`→`i18n.title`, `excerptAr/En`→`i18n.excerpt`, نص المقال→`i18n.body`, `status='published'`, `published_at=now()`, و`slug` مشتقّ من العنوان الإنجليزي.

- [ ] **Step 3: طبّق البذور** — `apply_migration` مع `name = "0007_seed"`.

- [ ] **Step 4: أعِد التحقّق — يجب أن ينجح**

```sql
select
  (select count(*) from public.taxonomies) as tax,
  (select count(*) from public.projects)   as proj,
  (select count(*) from public.contact)    as contact;
```
Expected: `tax = 4`، `proj >= 3`، `contact = 1`.

تحقّق من قراءة i18n:
```sql
select code, i18n->'title'->>'en' as title_en from public.projects order by sort_order limit 3;
```
Expected: `RY-1042 → Malqa Peaks`، `RY-1043 → Narjis Front`، `RY-1044 → Hittin Arcades`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_seed.sql
git commit -m "feat(db): seed locales, taxonomies, contact, sample projects and pages from data.js"
```

---

### Task 8: فحص نهائي وتوليد الأنواع

**Files:**
- Create: `supabase/types.ts` (اختياري، مفيد للمرحلة ب)

- [ ] **Step 1: فحص محقّقات الأمان والأداء**

`mcp__supabase-samaile__get_advisors` بنوع `security` ثم `performance`.
Expected: لا تحذيرات RLS. عالِج أي تحذير قبل المتابعة (مثلًا فهرس ناقص على مفتاح أجنبي كثير الاستخدام).

- [ ] **Step 2: تأكّد من كل الجداول موجودة**

`mcp__supabase-samaile__list_tables` (schema `public`).
Expected: `locales, taxonomies, projects, news, partners, stats, contact, pages, social_links, leads, admins` — ١١ جدولًا.

- [ ] **Step 3: ولّد أنواع TypeScript (للاستفادة في لوحة التحكم لاحقًا)**

`mcp__supabase-samaile__generate_typescript_types` واحفظ الناتج في `supabase/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/types.ts
git commit -m "chore(db): generate typescript types for schema"
```

---

## المراجعة الذاتية (تغطية الـspec)

| متطلّب في الـspec | المهمّة المغطّية |
|---|---|
| نموذج بيانات متعدّد المحليّات (§4) | Task 1, 2, 3, 4 (jsonb i18n) |
| locales مع الصيني معطّل (§4, §9) | Task 1 (بذور) |
| taxonomies للمدن/الأنواع (§4) | Task 1, 7 |
| ١١ جدولًا (§4) | Task 1–4 + list في Task 8 |
| RLS: زائر INSERT طلبات فقط، أدمن فقط للمحتوى (§5) | Task 5 |
| is_admin() + قائمة admins (§5) | Task 4 |
| Storage media عام/كتابة أدمن (§6) | Task 6 |
| بذور من data.js (§8) | Task 7 |
| لا قراءة عامة للمحتوى وقت التشغيل (§5, AC-1.10) | Task 5 (لا سياسة قراءة للزائر) |

**فجوات:** لا شيء لنطاق الخلفية. (نموذج/رفع الصور من الواجهة، والمبدّل، والنشر → خطط ب/ج.)

---

## التالي بعد هذه الخطة

- **الخطة ب:** لوحة التحكم (`/admin/`) — دخول + CRUD + رفع صور + صندوق الطلبات، تتكلم مع هذه الخلفية عبر `@supabase/supabase-js`.
- **الخطة ج:** الموقع العام + بايبلاين النشر — تحويل الصفحات لقوالب، توليد `/en/` `/zh/` وصفحات العقارات، أيقونة واتساب، سوشيال، نموذج الطلبات → `leads`، وEdge Function `publish`.
