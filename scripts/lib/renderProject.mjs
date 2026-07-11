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

export function unitsHtml(D, code, loc) {
  const units = Array.isArray(D?.units) ? D.units : [];
  if (units.length) {
    const H = { ar: "الوحدات", en: "Units", zh: "单元" }[loc] || "الوحدات";
    const fpLabel = { ar: "المخطط", en: "Floor plan", zh: "户型图" }[loc] || "المخطط";
    const blocks = units.map((u, ui) => {
      const title = tr(u.title, loc);
      const desc = tr(u.description, loc);
      const specs = Array.isArray(u.specs) ? u.specs : [];
      const specsHtml = specs.length
        ? `<div class="pfacts punit-rich__specs">`
          + specs.map((s) => `<div class="pfact"><span class="pfact__k">${tr(s.label, loc)}</span><span class="pfact__v">${tr(s.value, loc)}</span></div>`).join("")
          + `</div>`
        : "";
      const g = Array.isArray(u.gallery) ? u.gallery : [];
      let gHtml = "";
      if (g.length) {
        const { cells, overlays } = lightboxCells(g, `u-${code}-${ui}`, title, "pgallery__cell");
        gHtml = `<div class="pgallery__grid punit-rich__gallery">${cells}</div>${overlays}`;
      }
      const plans = Array.isArray(u.floorplans) ? u.floorplans : (u.floorplan ? [u.floorplan] : []);
      let fpHtml = "";
      if (plans.length) {
        const { cells, overlays } = lightboxCells(plans, `fp-${code}-${ui}`, `${title} ${fpLabel}`, "pfloorplan__cell");
        fpHtml = `<div class="pfloorplan"><h4>${fpLabel}</h4><div class="pfloorplan__grid">${cells}</div>${overlays}</div>`;
      }
      const open = ui === 0 ? " open" : "";
      return `<details class="punit-rich"${open}><summary class="punit-rich__sum">${title}</summary>`
        + `<div class="punit-rich__body">`
        + (desc ? `<p class="punit-rich__desc">${desc}</p>` : "")
        + specsHtml + gHtml + fpHtml
        + `</div></details>`;
    }).join("");
    return `<section class="psec"><h2>${H}</h2><div class="punits-rich">${blocks}</div></section>`;
  }
  // Legacy fallback: simple unitTypes cards (existing behavior preserved verbatim).
  const legacy = Array.isArray(D?.unitTypes) ? D.unitTypes : [];
  if (legacy.length) {
    const H = { ar: "أنواع الوحدات", en: "Unit types" }[loc] || "أنواع الوحدات";
    return `<section class="psec"><h2>${H}</h2><div class="punits">`
      + legacy.map((u) => `<div class="punit"><h3>${tr(u.title, loc)}</h3><p>${tr(u.detail, loc)}</p></div>`).join("")
      + `</div></section>`;
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
