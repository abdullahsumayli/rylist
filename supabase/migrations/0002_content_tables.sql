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
