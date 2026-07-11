// scripts/lib/applyContent.mjs
// يراكب محتوى قاعدة البيانات على العناصر المُعلَّمة بـ data-cms / data-cms-img.
// إن كانت القيمة فارغة/غائبة يبقى النص الافتراضي المكتوب في HTML (احتياط + SEO).
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export function applyContent(root, maps, locale) {
  const text = (maps && maps.text) || {};
  root.querySelectorAll("[data-cms]").forEach((el) => {
    const key = el.getAttribute("data-cms");
    const val = text[key] && text[key][locale];
    if (val != null && String(val).trim() !== "") el.set_content(esc(val));
  });
  const img = maps && maps.heroImage;
  if (img && String(img).trim() !== "") {
    root.querySelectorAll("[data-cms-img]").forEach((el) => {
      el.setAttribute("style", `background-image:url('${img}')`);
    });
  }
}
