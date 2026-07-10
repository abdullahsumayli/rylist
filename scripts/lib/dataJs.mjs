import fs from "node:fs";

/* ==========================================================================
   يكتب assets/js/data.js بشكلين في ملف واحد:
   1) ثوابت مسطّحة عامّة (CONTACT/PROJECTS/NEWS/PARTNERS/STATS) — يقرؤها main.js.
   2) window.RYLIST_DATA بالشكل الخام — يقرؤها public.js.
   المصدر الوحيد للحقيقة هو قاعدة البيانات (c)؛ هذا الملف محوِّل عرض فقط.
   ========================================================================== */

const pick = (o, loc) => (o && o[loc]) || "";
// اسم مترجَم مع سقوط للعربية ثم لأي قيمة متاحة
const name = (o, loc) => pick(o, loc) || pick(o, "ar") || "";

// فهرس تسميات التصنيفات: { city: { riyadh: {ar,en} }, property_type: {...} }
function taxIndex(taxonomies) {
  const idx = {};
  for (const t of taxonomies || []) (idx[t.kind] ||= {})[t.key] = t.i18n?.label || {};
  return idx;
}

function flatProjects(projects, tax) {
  const city = tax.city || {}, type = tax.property_type || {};
  return (projects || []).map((p) => {
    const title = p.i18n?.title || {}, district = p.i18n?.district || {};
    return {
      id: p.id, code: p.code || "", featured: !!p.featured,
      titleAr: name(title, "ar"), titleEn: name(title, "en"),
      cityKey: p.city_key || "", cityAr: name(city[p.city_key], "ar"), cityEn: name(city[p.city_key], "en"),
      districtAr: name(district, "ar"), districtEn: name(district, "en"),
      type: p.type_key || "", typeAr: name(type[p.type_key], "ar"), typeEn: name(type[p.type_key], "en"),
      status: p.status || "available", sold: p.sold ?? 0,
      priceMin: p.price_min ?? 0, priceMax: p.price_max ?? p.price_min ?? 0,
      area: p.area ?? "", bedsMin: p.beds_min ?? 0, bedsMax: p.beds_max ?? 0,
      img: p.image_url || "",
    };
  });
}

function flatNews(news) {
  return (news || []).map((n) => {
    const title = n.i18n?.title || {}, excerpt = n.i18n?.excerpt || {}, cat = n.i18n?.category || {};
    return {
      titleAr: name(title, "ar"), titleEn: name(title, "en"),
      catAr: pick(cat, "ar"), catEn: pick(cat, "en"),
      excerptAr: name(excerpt, "ar"), excerptEn: name(excerpt, "en"),
      img: n.image_url || "", date: (n.published_at || "").slice(0, 10),
    };
  });
}

function flatPartners(partners) {
  return (partners || []).map((p) => ({
    ar: name(p.i18n?.name, "ar"), en: name(p.i18n?.name, "en"),
    logo: p.logo_url || "",
  }));
}

function flatStats(stats) {
  return (stats || []).map((s) => ({
    value: s.value ?? 0,
    decimals: Number.isInteger(s.value) ? 0 : 1,
    sym: s.suffix || "",
    labelAr: name(s.i18n?.label, "ar"), labelEn: name(s.i18n?.label, "en"),
  }));
}

function flatContact(contact) {
  const c = contact || {};
  return {
    whatsapp: c.whatsapp || "", email: c.email || "", phone: c.phone || "", map: c.map_url || "",
    addressAr: pick(c.i18n?.address, "ar"), addressEn: pick(c.i18n?.address, "en"),
    hoursAr: pick(c.i18n?.hours, "ar"), hoursEn: pick(c.i18n?.hours, "en"),
  };
}

export function writeDataJs(out, c) {
  const tax = taxIndex(c.taxonomies);
  const raw = {
    locales: c.locales, taxonomies: c.taxonomies, projects: c.projects,
    news: c.news, partners: c.partners, stats: c.stats, contact: c.contact, social: c.social,
  };
  const body =
    "/* مولَّد آليًا بواسطة scripts/lib/dataJs.mjs — لا تحرّره يدويًا. */\n" +
    "const CONTACT = " + JSON.stringify(flatContact(c.contact)) + ";\n" +
    "const PROJECTS = " + JSON.stringify(flatProjects(c.projects, tax)) + ";\n" +
    "const NEWS = " + JSON.stringify(flatNews(c.news)) + ";\n" +
    "const PARTNERS = " + JSON.stringify(flatPartners(c.partners)) + ";\n" +
    "const STATS = " + JSON.stringify(flatStats(c.stats)) + ";\n" +
    "window.RYLIST_DATA = " + JSON.stringify(raw) + ";\n";
  fs.mkdirSync(out + "/assets/js", { recursive: true });
  fs.writeFileSync(out + "/assets/js/data.js", body);
}
