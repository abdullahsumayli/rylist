-- Structured, bilingual project content shown on the detail page:
-- { facts:[{label,value}], unitTypes:[{title,detail}], features:[{ar,en}], location:[{ar,en}] }
alter table projects add column if not exists details jsonb not null default '{}'::jsonb;
