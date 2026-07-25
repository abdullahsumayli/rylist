// معرّف المقال (slug) — يُشتق تلقائيًا من العنوان. نقي (بلا DOM) ليُختبَر تحت node.
// عنوان لاتيني → kebab-case؛ عنوان عربي بحت (أو فارغ) → معرّف قصير ثابت "p-<base36>".
export function makeSlug(title, now) {
  const latin = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (latin) return latin;
  return "p-" + Math.floor(now ?? Date.now()).toString(36);
}
