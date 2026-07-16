// admin/content-data.js — pure data helpers for the project content editor.
// NO browser / DOM / Supabase imports — safe to unit-test under `node --test`.

export const blankI18n = () => ({ ar: "", en: "", zh: "" });
export const blankPair = () => ({ label: blankI18n(), value: blankI18n() });
export const blankUnitType = () => ({ title: blankI18n(), detail: blankI18n() });
export const blankUnit = () => ({
  title: blankI18n(), description: blankI18n(), price: blankI18n(),
  specs: [], gallery: [], floorplan: "",
});

// buildPayload(draft) -> { gallery, details }
// draft = { gallery:[...], details:{...} } loaded full from DB and edited in place.
// Returns only the two persisted columns, preserving every details key we never edited.
export function buildPayload(draft) {
  const gallery = (draft?.gallery || []).filter((u) => typeof u === "string" && u.trim() !== "");
  const details = { ...(draft?.details || {}) };
  return { gallery, details };
}
