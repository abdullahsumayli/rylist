-- 0013_home_content.sql — محتوى الصفحة الرئيسية + الهيدر/الفوتر + المظهر (كلها صف واحد id=1)

-- نصوص جسم الصفحة الرئيسية + صورة الهيرو
create table if not exists public.home_content (
  id             int primary key default 1 check (id = 1),
  hero_image_url text,
  i18n           jsonb not null default '{}'::jsonb,   -- { hero_title:{ar,en,zh}, ... }
  updated_at     timestamptz not null default now()
);
create trigger trg_home_content_updated before update on public.home_content
  for each row execute function public.set_updated_at();

-- نصوص الهيدر/الفوتر المشتركة
create table if not exists public.site_chrome (
  id         int primary key default 1 check (id = 1),
  i18n       jsonb not null default '{}'::jsonb,        -- { nav_home:{...}, footer_tag:{...}, ... }
  updated_at timestamptz not null default now()
);
create trigger trg_site_chrome_updated before update on public.site_chrome
  for each row execute function public.set_updated_at();

-- المظهر: معرّفات مجموعات جاهزة
create table if not exists public.site_theme (
  id            int primary key default 1 check (id = 1),
  font_preset   text not null default 'classic',
  accent_preset text not null default 'gold',
  updated_at    timestamptz not null default now()
);
create trigger trg_site_theme_updated before update on public.site_theme
  for each row execute function public.set_updated_at();

-- صفوف البذرة (فارغة النصوص = يبقى الافتراضي في HTML)
insert into public.home_content (id) values (1) on conflict (id) do nothing;
insert into public.site_chrome  (id) values (1) on conflict (id) do nothing;
insert into public.site_theme   (id) values (1) on conflict (id) do nothing;

-- RLS: قراءة عامة، كتابة للأدمن فقط
alter table public.home_content enable row level security;
alter table public.site_chrome  enable row level security;
alter table public.site_theme   enable row level security;

create policy "home_content read"  on public.home_content for select using (true);
create policy "home_content write" on public.home_content for all
  using (public.is_admin()) with check (public.is_admin());

create policy "site_chrome read"   on public.site_chrome for select using (true);
create policy "site_chrome write"  on public.site_chrome for all
  using (public.is_admin()) with check (public.is_admin());

create policy "site_theme read"    on public.site_theme for select using (true);
create policy "site_theme write"   on public.site_theme for all
  using (public.is_admin()) with check (public.is_admin());
