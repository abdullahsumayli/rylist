-- Allow a "soon" (قريبًا) project status for upcoming projects (e.g. NAJD 7).
alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status = any (array['available'::text, 'reserved'::text, 'sold'::text, 'soon'::text]));
