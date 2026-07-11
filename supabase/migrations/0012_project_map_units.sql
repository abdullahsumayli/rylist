-- Per-project map coordinates (optional; the page falls back to a district search when null).
alter table public.projects add column if not exists map_lat double precision;
alter table public.projects add column if not exists map_lng double precision;

-- Rich units live inside the existing projects.details jsonb, alongside the legacy unitTypes:
--   details.units = [
--     { title:{ar,en}, description:{ar,en},
--       specs:[{label:{ar,en}, value:{ar,en}}],
--       gallery:["url"], floorplan:"url"  (or floorplans:["url"]) }
--   ]
-- When details.units is absent, the renderer falls back to the legacy details.unitTypes cards.
