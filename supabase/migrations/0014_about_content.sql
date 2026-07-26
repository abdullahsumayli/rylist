-- 0014_about_content.sql — نصوص صفحة "من نحن" (صف واحد id=1)، بنفس نمط home_content

create table if not exists public.about_content (
  id         int primary key default 1 check (id = 1),
  i18n       jsonb not null default '{}'::jsonb,   -- { about_eyebrow:{ar,en,zh}, ... }
  updated_at timestamptz not null default now()
);
create trigger trg_about_content_updated before update on public.about_content
  for each row execute function public.set_updated_at();

insert into public.about_content (id) values (1) on conflict (id) do nothing;

alter table public.about_content enable row level security;
create policy "about_content read"  on public.about_content for select using (true);
create policy "about_content write" on public.about_content for all
  using (public.is_admin()) with check (public.is_admin());

-- إزالة إدخال "about" الميّت من قسم "الصفحات" (services يبقى)
delete from public.pages where key = 'about';
alter table public.pages drop constraint pages_key_check;
alter table public.pages add  constraint pages_key_check check (key in ('services'));
