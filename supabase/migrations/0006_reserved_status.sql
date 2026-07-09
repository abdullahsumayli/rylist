-- 0006_reserved_status.sql — allow 'reserved' alongside 'available' and 'sold'
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('available','reserved','sold'));
