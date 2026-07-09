-- Per-project image gallery (array of public image URLs), shown on the detail page.
alter table projects add column if not exists gallery jsonb not null default '[]'::jsonb;
