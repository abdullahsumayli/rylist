// Pure, testable HTML builders for the project detail page.
// No filesystem / no Supabase — takes plain objects, returns HTML strings.

export const tr = (o, loc) => (o && (o[loc] || o.ar)) || "";
export const fill = (s, map) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? "");

export function mapHtml({ lat, lng, district, cityLabel, location, loc }) {
  const H = { ar: "الخرائط", en: "Maps", zh: "地图" }[loc] || "الخرائط";
  const hasCoords = lat != null && lng != null && lat !== "" && lng !== "";
  const q = hasCoords
    ? `${lat},${lng}&z=15`
    : `${encodeURIComponent([district, cityLabel].filter(Boolean).join(" ") || "الرياض")}&z=13`;
  const src = `https://maps.google.com/maps?q=${q}&output=embed`;
  const nearLabel = { ar: "المعالم القريبة", en: "Nearby landmarks", zh: "周边地标" }[loc] || "المعالم القريبة";
  const locs = Array.isArray(location) ? location : [];
  const nearHtml = locs.length
    ? `<h3 class="pmap__nearttl">${nearLabel}</h3><ul class="plocation">`
      + locs.map((x) => `<li>${tr(x, loc)}</li>`).join("") + `</ul>`
    : "";
  return `<section class="psec pmap"><h2>${H}</h2>`
    + `<div class="pmap__frame"><iframe src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${H}"></iframe></div>`
    + nearHtml
    + `</section>`;
}

// CSS-only lightbox cell + overlay, reusing the existing .pgallery__lb styles.
function lightboxCells(urls, idPrefix, altBase, cellClass) {
  const cells = urls.map((u, i) =>
    `<a class="${cellClass}" href="#${idPrefix}-${i}"><img loading="lazy" src="${u}" alt="${altBase} ${i + 1}"></a>`).join("");
  const overlays = urls.map((u, i) =>
    `<div class="pgallery__lb" id="${idPrefix}-${i}"><a class="pgallery__bg" href="#"></a><img src="${u}" alt=""><a class="pgallery__x" href="#" aria-label="إغلاق">×</a></div>`).join("");
  return { cells, overlays };
}

// A model card is content-bearing if any field is filled. Blank template slots
// (the editor seeds 4 so it always offers spare models) never render publicly.
function unitHasContent(u) {
  if (!u || typeof u !== "object") return false;
  const anyText = (v) => v && typeof v === "object"
    ? Object.values(v).some((x) => typeof x === "string" && x.trim() !== "")
    : (typeof v === "string" && v.trim() !== "");
  const plans = Array.isArray(u.floorplans) ? u.floorplans : (u.floorplan ? [u.floorplan] : []);
  return anyText(u.title) || anyText(u.price) || anyText(u.description)
    || (Array.isArray(u.specs) && u.specs.length > 0)
    || plans.some((s) => typeof s === "string" && s.trim() !== "");
}

export function unitsHtml(D, code, loc) {
  const units = Array.isArray(D?.units) ? D.units : [];
  const shown = units.filter(unitHasContent);
  if (shown.length) {
    const H = { ar: "النماذج", en: "Models", zh: "户型" }[loc] || "النماذج";
    const fpLabel = { ar: "المخطط", en: "Floor plan", zh: "户型图" }[loc] || "المخطط";
    // Models render as a card grid — all visible at once. Data + floor-plan image
    // per card; unit gallery photos are intentionally omitted.
    let overlays = "";
    const lb = (id, url) =>
      `<div class="pgallery__lb" id="${id}"><a class="pgallery__bg" href="#"></a><img src="${url}" alt=""><a class="pgallery__x" href="#" aria-label="إغلاق">×</a></div>`;
    const cards = shown.map((u, ui) => {
      const title = tr(u.title, loc);
      const price = tr(u.price, loc);
      const desc = tr(u.description, loc);
      const specs = Array.isArray(u.specs) ? u.specs : [];
      const plans = (Array.isArray(u.floorplans) ? u.floorplans : (u.floorplan ? [u.floorplan] : []))
        .filter((s) => typeof s === "string" && s.trim() !== "");
      plans.forEach((url, pi) => { overlays += lb(`fp-${code}-${ui}-${pi}`, url); });
      const specsHtml = specs.length
        ? `<div class="punit-card__meta">` + specs.map((s) => `<span>${tr(s.label, loc)}: ${tr(s.value, loc)}</span>`).join("") + `</div>`
        : "";
      const planLink = plans.length
        ? `<a class="punit-card__plan" href="#fp-${code}-${ui}-0"><img loading="lazy" src="${plans[0]}" alt="${title} ${fpLabel}"><span>${fpLabel}</span></a>`
        : "";
      return `<article class="punit-card"><div class="punit-card__body">`
        + `<h3 class="punit-card__title">${title}</h3>`
        + (price ? `<div class="punit-card__price">${price}</div>` : "")
        + (desc ? `<p class="punit-card__desc">${desc}</p>` : "")
        + specsHtml + planLink
        + `</div></article>`;
    }).join("");
    return `<section class="psec"><h2>${H}</h2><div class="grid grid-3 punits-grid">${cards}</div>${overlays}</section>`;
  }
  // Legacy fallback: simple unitTypes cards (existing behavior preserved verbatim).
  const legacy = Array.isArray(D?.unitTypes) ? D.unitTypes : [];
  if (legacy.length) {
    const H = { ar: "أنواع الوحدات", en: "Unit types" }[loc] || "أنواع الوحدات";
    let overlays = "";
    const cards = legacy.map((u, ui) => {
      const title = tr(u.title, loc);
      const imgs = (Array.isArray(u.images) ? u.images : []).filter((s) => typeof s === "string" && s.trim() !== "");
      let imgHtml = "";
      if (imgs.length) {
        const lb = lightboxCells(imgs, `ut-${code}-${ui}`, title, "punit__thumb");
        imgHtml = `<div class="punit__imgs">${lb.cells}</div>`;
        overlays += lb.overlays;
      }
      return `<div class="punit"><h3>${title}</h3><p>${tr(u.detail, loc)}</p>${imgHtml}</div>`;
    }).join("");
    return `<section class="psec"><h2>${H}</h2><div class="punits">${cards}</div>${overlays}</section>`;
  }
  return "";
}

export function galleryHtml(images, code, title, loc) {
  const imgs = Array.isArray(images) ? images : [];
  if (!imgs.length) return "";
  const H = { ar: "معرض الصور", en: "Photo gallery", zh: "图库" }[loc] || "معرض الصور";
  const { cells, overlays } = lightboxCells(imgs, `g-${code}`, title, "pgallery__cell");
  return `<section class="pgallery"><h2>${H}</h2><div class="pgallery__grid">${cells}</div>${overlays}</section>`;
}

export function factsHtml(D, loc) {
  const facts = Array.isArray(D?.facts) ? D.facts : [];
  if (!facts.length) return "";
  const H = { ar: "تفاصيل المشروع", en: "Project details" }[loc] || "تفاصيل المشروع";
  return `<section class="psec"><h2>${H}</h2><div class="pfacts">`
    + facts.map((f) => `<div class="pfact"><span class="pfact__k">${tr(f.label, loc)}</span><span class="pfact__v">${tr(f.value, loc)}</span></div>`).join("")
    + `</div></section>`;
}

export function featuresHtml(D, loc) {
  const feats = Array.isArray(D?.features) ? D.features : [];
  if (!feats.length) return "";
  const H = { ar: "المزايا والمرافق", en: "Features & amenities" }[loc] || "المزايا والمرافق";
  return `<section class="psec"><h2>${H}</h2><ul class="pfeatures">`
    + feats.map((x) => `<li>${tr(x, loc)}</li>`).join("")
    + `</ul></section>`;
}

const CTA = { ar: "استفسر عبر واتساب", en: "Enquire on WhatsApp", zh: "通过 WhatsApp 咨询" };
const DL = { ar: "تحميل البروشور", en: "Download brochure", zh: "下载手册" };
export const FAHEM = { ar: "استشير فاهم", en: "Ask Fahem", zh: "咨询 فاهم" };
export const fahemHref = (loc) => (loc === "ar" ? "/fahem.html" : `/${loc}/fahem.html`);
const STATUS = {
  available: { ar: "متاح", en: "Available", zh: "可售" },
  reserved: { ar: "محجوز", en: "Reserved", zh: "已预订" },
  sold: { ar: "مباع", en: "Sold", zh: "已售" },
  soon: { ar: "قريبًا", en: "Soon", zh: "即将推出" },
};
const STATUS_CLASS = { sold: "status-pill--sold", reserved: "status-pill--reserved", soon: "status-pill--soon" };

// Assemble one full project page. `ctx` = { loc, dir, base, tax(kind,key,loc), contact }.
export function renderProjectHtml(tmpl, p, ctx) {
  const { loc, dir, base, tax, theme } = ctx;
  const t = p.i18n?.title?.[loc] || p.i18n?.title?.ar || p.code;
  const url = (l) => `${base}${l === "ar" ? "" : "/" + l}/projects/${p.code}.html`;
  const hreflang = ["ar", "en", "zh"].map((l) => `\n<link rel="alternate" hreflang="${l}" href="${url(l)}">`).join("");
  const wa = ctx.contact?.whatsapp
    ? `https://wa.me/${ctx.contact.whatsapp}?text=${encodeURIComponent(`${t} (${p.code})`)}`
    : "#";
  const price = p.price_min
    ? `${p.price_min.toLocaleString("en-US")} – ${(p.price_max || p.price_min).toLocaleString("en-US")} ${loc === "en" ? "SAR" : "ريال"}`
    : ({ ar: "السعر عند الطلب", en: "Price on request", zh: "价格待询" }[loc] || "السعر عند الطلب");
  const D = p.details || {};
  const brochure = p.brochure_url
    ? `<a class="btn btn--ghost" href="${p.brochure_url}" target="_blank" rel="noopener">${DL[loc] || DL.ar}</a>`
    : "";
  return fill(tmpl, {
    lang: loc, dir, title: t, desc: (p.i18n?.description?.[loc] || "").slice(0, 150),
    canonical: url(loc), hreflang,
    themeHead: theme ? `<link rel="stylesheet" href="${theme.href}"><style id="theme-vars">:root{${theme.vars}}</style>` : "",
    assets: loc === "ar" ? ".." : "../..", home: loc === "ar" ? "/" : `/${loc}/`,
    fahemHref: fahemHref(loc), fahemLabel: FAHEM[loc] || FAHEM.ar,
    image: p.image_url || "", district: p.i18n?.district?.[loc] || "",
    typeLabel: tax("property_type", p.type_key, loc), cityLabel: tax("city", p.city_key, loc),
    price, description: p.i18n?.description?.[loc] || "", whatsapp: wa, cta: CTA[loc] || CTA.ar, brochure,
    gallery: galleryHtml(p.gallery, p.code, t, loc),
    facts: factsHtml(D, loc),
    units: unitsHtml(D, p.code, loc),
    features: featuresHtml(D, loc),
    map: mapHtml({ lat: p.map_lat, lng: p.map_lng, district: p.i18n?.district?.[loc] || "", cityLabel: tax("city", p.city_key, loc), location: D.location, loc }),
    statusLabel: (STATUS[p.status] || {})[loc] || "",
    statusClass: STATUS_CLASS[p.status] || "",
  });
}
