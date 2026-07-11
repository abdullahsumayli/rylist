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
