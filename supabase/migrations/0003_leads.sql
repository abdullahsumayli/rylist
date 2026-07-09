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
