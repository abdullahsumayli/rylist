// admin/content-data.js — pure data helpers for the project content editor.
// NO browser / DOM / Supabase imports — safe to unit-test under `node --test`.

export const blankI18n = () => ({ ar: "", en: "", zh: "" });
export const blankPair = () => ({ label: blankI18n(), value: blankI18n() });
export const blankUnitType = () => ({ title: blankI18n(), detail: blankI18n() });
export const blankUnit = () => ({
  title: blankI18n(), description: blankI18n(), price: blankI18n(),
  specs: [], gallery: [], floorplan: "",
});

// A model is content-bearing if the user filled any field. The editor seeds 4 blank
// template slots so it always offers spare models; those blanks are dropped on save.
export function unitHasContent(u) {
  if (!u || typeof u !== "object") return false;
  const anyText = (v) => v && typeof v === "object"
    ? Object.values(v).some((x) => typeof x === "string" && x.trim() !== "")
    : (typeof v === "string" && v.trim() !== "");
  const plans = Array.isArray(u.floorplans) ? u.floorplans : (u.floorplan ? [u.floorplan] : []);
  const gallery = Array.isArray(u.gallery) ? u.gallery : [];
  return anyText(u.title) || anyText(u.price) || anyText(u.description)
    || (Array.isArray(u.specs) && u.specs.length > 0)
    || plans.some((s) => typeof s === "string" && s.trim() !== "")
    || gallery.some((s) => typeof s === "string" && s.trim() !== "");
}

// buildPayload(draft) -> { gallery, details }
// draft = { gallery:[...], details:{...} } loaded full from DB and edited in place.
// Returns only the two persisted columns, preserving every details key we never edited.
export function buildPayload(draft) {
  const gallery = (draft?.gallery || []).filter((u) => typeof u === "string" && u.trim() !== "");
  const details = { ...(draft?.details || {}) };
  // Drop blank model templates seeded for the editor — persist only filled ones.
  if (Array.isArray(details.units)) details.units = details.units.filter(unitHasContent);
  return { gallery, details };
}
