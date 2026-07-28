// scripts/lib/pageContent.mjs
// خريطة محتوى قاعدة البيانات التي يراكبها applyContent على عناصر data-cms.
// كانت مكتوبة داخل renderPages، فبقيت صفحات المشاريع والمقالات — ومعها فوترها —
// خارج المحتوى القابل للتحرير من لوحة التحكم.
export function pageContent(c) {
  return {
    text: { ...(c.home?.i18n || {}), ...(c.chrome?.i18n || {}), ...(c.about?.i18n || {}) },
    heroImage: c.home?.hero_image_url || "",
  };
}
