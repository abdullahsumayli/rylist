// scripts/lib/applyContent.mjs
// يراكب محتوى قاعدة البيانات على العناصر المُعلَّمة بـ data-cms / data-cms-img.
// إن كانت القيمة فارغة/غائبة يبقى النص الافتراضي المكتوب في HTML (احتياط + SEO).
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
// نُرمّز الأحرف التي قد تكسر url('...') داخل خاصية style؛ ملاحظة: encodeURIComponent
// لا يُرمّز ' ( ) لذا نُرمّز يدويًا كل حرف في الفئة إلى نسبة مئوية.
const safeCssUrl = (s) =>
  String(s).replace(/[\\'"()\s]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));

export function applyContent(root, maps, locale) {
  const text = (maps && maps.text) || {};
  root.querySelectorAll("[data-cms]").forEach((el) => {
    const key = el.getAttribute("data-cms");
    const val = text[key]?.[locale];
    if (val != null && String(val).trim() !== "") el.set_content(esc(val));
  });
  const img = maps && maps.heroImage;
  if (img && String(img).trim() !== "") {
    root.querySelectorAll("[data-cms-img]").forEach((el) => {
      el.setAttribute("style", `background-image:url('${safeCssUrl(img)}')`);
    });
    // الـ <link rel=preload> لازم يطابق الصورة المعروضة فعليًا؛ وإلا حمّل المتصفح
    // صورة HTML الافتراضية بلا استخدام (تنزيل مهدور يضرّ الـ LCP).
    // نحذف type لأن رابط الأدمن قد يكون jpg/png وليس webp.
    root.querySelectorAll("[data-cms-preload]").forEach((el) => {
      el.setAttribute("href", String(img));
      el.removeAttribute("type");
    });
  }
}
