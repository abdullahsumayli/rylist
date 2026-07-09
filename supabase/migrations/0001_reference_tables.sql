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
