-- Downloadable brochure (PDF) URL per project.
alter table projects add column if not exists brochure_url text;
