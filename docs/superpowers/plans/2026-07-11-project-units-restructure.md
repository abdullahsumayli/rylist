# Project Page Restructure + Rich Inline Units — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the project detail page and turn "unit types" into rich, inline, expandable unit blocks (each with its own gallery, description, specs, and floor plan), plus add an always-on maps section — all statically generated, backward-compatible with existing project data.

**Architecture:** Extract a pure, testable render module (`scripts/lib/renderProject.mjs`) that builds each section's HTML from a plain project object. `projectPages.mjs` becomes a thin loop that reads data and writes files. Sections are ordered by the template (`templates/project.html`). Units and maps are pure HTML/CSS (accordion via `<details>`, keyless Google Maps `<iframe>`) — no client JS. Missing data degrades gracefully (sections hide; map falls back to district search).

**Tech Stack:** Node 22 ESM, Node built-in test runner (`node:test` + `node:assert/strict`) — no new dependencies. Supabase (schema migration). Vanilla HTML/CSS.

Spec: [docs/superpowers/specs/2026-07-11-project-units-restructure-design.md](../specs/2026-07-11-project-units-restructure-design.md)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/lib/renderProject.mjs` (new) | Pure section builders + full-page assembler. All HTML logic lives here. Testable without Supabase. |
| `scripts/lib/renderProject.test.mjs` (new) | Unit + integration tests for the render module. |
| `scripts/lib/projectPages.mjs` (rewrite) | Thin loop: for each locale × project, call the assembler and write the file. |
| `templates/project.html` (modify) | Section slot order. Splits `{{details}}` into `{{facts}} {{units}} {{features}} {{map}}`; moves `{{gallery}}` above description. |
| `assets/css/styles.css` (append) | `.punits-rich`, `.punit-rich`, `.pfloorplan`, `.pmap` styles; reuses existing `.pgallery__lb` lightbox. |
| `supabase/migrations/0012_project_map_units.sql` (new) | Adds `map_lat`, `map_lng`; documents `details.units` shape. |
| `admin/entities.js` (modify) | Adds `map_lat`, `map_lng` number fields to the project form. |
| `supabase/types.ts` (modify) | Adds the two new columns to the `projects` type. |
| `package.json` (modify) | Adds `"test": "node --test scripts/"`. |

**Data shape (reference, used throughout):**
```jsonc
project = {
  code, city_key, type_key, status, price_min, price_max,
  image_url, brochure_url, map_lat, map_lng,   // map_lat/lng new, nullable
  gallery: [ "url", … ],
  i18n: { title:{ar,en,zh}, district:{ar,en,zh}, description:{ar,en,zh} },
  details: {
    facts:     [{ label:{ar,en}, value:{ar,en} }],
    unitTypes: [{ title:{ar,en}, detail:{ar,en} }],           // legacy — fallback only
    units:     [{ title:{ar,en}, description:{ar,en},
                  specs:[{label:{ar,en},value:{ar,en}}],
                  gallery:["url"], floorplan:"url" | floorplans:["url"] }],
    features:  [{ ar, en }],
    location:  [{ ar, en }]
  }
}
```

**Translation + escape helpers (defined once at top of `renderProject.mjs`, used by every builder):**
```js
export const tr = (o, loc) => (o && (o[loc] || o.ar)) || "";
export const fill = (s, map) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? "");
```
> Note: matches existing `projectPages.mjs` behavior exactly (no HTML escaping — content is trusted admin input). `fill` uses a function replacer, so `$` in values is safe.

---

### Task 1: Test runner + `mapHtml` (new maps section)

**Files:**
- Create: `scripts/lib/renderProject.mjs`
- Create: `scripts/lib/renderProject.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the test script to `package.json`**

Change the `"scripts"` block to:
```json
"scripts": { "build": "node scripts/build.mjs", "test": "node --test scripts/" },
```

- [ ] **Step 2: Write the failing test** — create `scripts/lib/renderProject.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHtml } from "./renderProject.mjs";

test("mapHtml embeds exact coordinates when lat/lng present", () => {
  const html = mapHtml({ lat: 24.77, lng: 46.73, district: "الرمال", cityLabel: "الرياض", location: [], loc: "ar" });
  assert.match(html, /q=24\.77,46\.73&z=15/);
  assert.match(html, /output=embed/);
  assert.match(html, /<section class="psec pmap">/);
});

test("mapHtml falls back to district + city query when no coords", () => {
  const html = mapHtml({ lat: null, lng: null, district: "الرمال", cityLabel: "الرياض", location: [], loc: "ar" });
  assert.match(html, /q=/);
  assert.doesNotMatch(html, /q=null/);
  assert.match(html, new RegExp(encodeURIComponent("الرمال الرياض")));
});

test("mapHtml always renders a section (even with empty everything)", () => {
  const html = mapHtml({ lat: null, lng: null, district: "", cityLabel: "", location: [], loc: "ar" });
  assert.match(html, /<iframe/);
});

test("mapHtml appends nearby-landmarks list when location present", () => {
  const html = mapHtml({ lat: null, lng: null, district: "الرمال", cityLabel: "الرياض",
    location: [{ ar: "قريب من المطار", en: "Near airport" }], loc: "ar" });
  assert.match(html, /المعالم القريبة/);
  assert.match(html, /قريب من المطار/);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './renderProject.mjs'` / `mapHtml is not a function`.

- [ ] **Step 4: Write minimal implementation** — create `scripts/lib/renderProject.mjs`

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/lib/renderProject.mjs scripts/lib/renderProject.test.mjs
git commit -m "feat(project): add keyless maps section builder + test runner"
```

---

### Task 2: `unitsHtml` (rich units + legacy fallback)

**Files:**
- Modify: `scripts/lib/renderProject.mjs`
- Modify: `scripts/lib/renderProject.test.mjs`

- [ ] **Step 1: Write the failing tests** — append to `scripts/lib/renderProject.test.mjs`

```js
import { unitsHtml } from "./renderProject.mjs";

const richUnit = {
  title: { ar: "تاون هاوس ٣ غرف", en: "3-bed townhouse" },
  description: { ar: "وحدة فاخرة", en: "Luxury unit" },
  specs: [{ label: { ar: "المساحة" }, value: { ar: "٢٠٠ م²" } }],
  gallery: ["https://x/u1.jpg", "https://x/u2.jpg"],
  floorplan: "https://x/plan1.jpg",
};

test("unitsHtml renders rich units as <details> blocks with first open", () => {
  const html = unitsHtml({ units: [richUnit, { title: { ar: "٤ غرف" } }] }, "najd-2", "ar");
  assert.match(html, /<details class="punit-rich" open>/);          // first open
  assert.match(html, /<details class="punit-rich">/);               // second closed
  assert.match(html, /تاون هاوس ٣ غرف/);
  assert.match(html, /وحدة فاخرة/);
  assert.match(html, /٢٠٠ م²/);
});

test("unitsHtml renders unit gallery + floor plan with unique lightbox ids", () => {
  const html = unitsHtml({ units: [richUnit] }, "najd-2", "ar");
  assert.match(html, /id="u-najd-2-0-0"/);   // unit gallery image 0
  assert.match(html, /id="u-najd-2-0-1"/);   // unit gallery image 1
  assert.match(html, /id="fp-najd-2-0-0"/);  // unit floor plan 0
  assert.match(html, /المخطط/);
});

test("unitsHtml supports floorplans array", () => {
  const html = unitsHtml({ units: [{ title: { ar: "أ" }, floorplans: ["https://x/a.jpg", "https://x/b.jpg"] }] }, "p", "ar");
  assert.match(html, /id="fp-p-0-0"/);
  assert.match(html, /id="fp-p-0-1"/);
});

test("unitsHtml falls back to legacy unitTypes cards when no units", () => {
  const html = unitsHtml({ unitTypes: [{ title: { ar: "٣ غرف" }, detail: { ar: "تفاصيل" } }] }, "p", "ar");
  assert.match(html, /class="punit"/);
  assert.match(html, /أنواع الوحدات/);
  assert.match(html, /٣ غرف/);
  assert.doesNotMatch(html, /punit-rich/);
});

test("unitsHtml returns empty string when no unit data at all", () => {
  assert.equal(unitsHtml({}, "p", "ar"), "");
  assert.equal(unitsHtml({ units: [] }, "p", "ar"), "");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `unitsHtml is not a function`.

- [ ] **Step 3: Write minimal implementation** — append to `scripts/lib/renderProject.mjs`

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all Task 1 + Task 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/renderProject.mjs scripts/lib/renderProject.test.mjs
git commit -m "feat(project): rich inline unit blocks with legacy fallback"
```

---

### Task 3: `galleryHtml`, `factsHtml`, `featuresHtml` (extract existing behavior)

**Files:**
- Modify: `scripts/lib/renderProject.mjs`
- Modify: `scripts/lib/renderProject.test.mjs`

- [ ] **Step 1: Write the failing tests** — append to `scripts/lib/renderProject.test.mjs`

```js
import { galleryHtml, factsHtml, featuresHtml } from "./renderProject.mjs";

test("galleryHtml renders grid + lightbox, empty when no images", () => {
  const html = galleryHtml(["https://x/1.jpg"], "najd-2", "نجد ٢", "ar");
  assert.match(html, /class="pgallery"/);
  assert.match(html, /id="g-najd-2-0"/);
  assert.equal(galleryHtml([], "najd-2", "نجد ٢", "ar"), "");
  assert.equal(galleryHtml(undefined, "najd-2", "نجد ٢", "ar"), "");
});

test("factsHtml renders facts grid, empty when none", () => {
  const html = factsHtml({ facts: [{ label: { ar: "النوع" }, value: { ar: "تاون هاوس" } }] }, "ar");
  assert.match(html, /pfacts/);
  assert.match(html, /النوع/);
  assert.match(html, /تاون هاوس/);
  assert.equal(factsHtml({}, "ar"), "");
});

test("featuresHtml renders list, empty when none", () => {
  const html = featuresHtml({ features: [{ ar: "مسبح" }] }, "ar");
  assert.match(html, /pfeatures/);
  assert.match(html, /مسبح/);
  assert.equal(featuresHtml({}, "ar"), "");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `galleryHtml is not a function`.

- [ ] **Step 3: Write minimal implementation** — append to `scripts/lib/renderProject.mjs`

```js
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
```
> Note: `lightboxCells` is already defined in Task 2. Gallery id prefix `g-${code}` yields ids `g-{code}-{i}`, identical to the original build output — no collision with unit ids (`u-…`, `fp-…`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/renderProject.mjs scripts/lib/renderProject.test.mjs
git commit -m "feat(project): extract gallery/facts/features section builders"
```

---

### Task 4: Reorder `templates/project.html`

**Files:**
- Modify: `templates/project.html`

- [ ] **Step 1: Replace the whole file** with the new slot order

```html
<!doctype html><html lang="{{lang}}" dir="{{dir}}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}} — RYLIST</title>
<meta name="description" content="{{desc}}">
<link rel="canonical" href="{{canonical}}">{{hreflang}}
<link rel="stylesheet" href="{{assets}}/assets/css/styles.css">
</head><body>
<main class="container pdetail">
  <a class="pdetail__back" href="{{home}}">← RYLIST</a>
  <figure class="pdetail__hero"><img src="{{image}}" alt="{{title}}"></figure>
  <header class="pdetail__head">
    <h1>{{title}}</h1>
    <p><span class="status-pill {{statusClass}}">{{statusLabel}}</span></p>
    <p class="pdetail__loc">{{district}} · {{typeLabel}} · {{cityLabel}}</p>
    <p class="pdetail__price">{{price}}</p>
  </header>
  {{gallery}}
  <div class="pdetail__desc">{{description}}</div>
  {{facts}}
  {{units}}
  {{features}}
  {{map}}
  <div class="btn-row"><a class="btn btn--primary" href="{{whatsapp}}" target="_blank" rel="noopener">{{cta}}</a>{{brochure}}</div>
</main></body></html>
```

- [ ] **Step 2: Verify no orphan slots remain**

Run: `grep -o "{{[a-z]*}}" templates/project.html | sort -u`
Expected: only these slots appear — `{{assets}} {{brochure}} {{canonical}} {{cta}} {{description}} {{desc}} {{dir}} {{district}} {{facts}} {{features}} {{gallery}} {{home}} {{hreflang}} {{image}} {{lang}} {{map}} {{price}} {{statusClass}} {{statusLabel}} {{title}} {{typeLabel}} {{units}} {{whatsapp}}`
Confirm `{{details}}` is **gone** and `{{facts}} {{units}} {{features}} {{map}}` are present.

- [ ] **Step 3: Commit**

```bash
git add templates/project.html
git commit -m "feat(project): reorder page — gallery first, split details into facts/units/features/map"
```

---

### Task 5: `renderProjectHtml` full-page assembler + integration order test

**Files:**
- Modify: `scripts/lib/renderProject.mjs`
- Modify: `scripts/lib/renderProject.test.mjs`

- [ ] **Step 1: Write the failing integration test** — append to `scripts/lib/renderProject.test.mjs`

```js
import { renderProjectHtml } from "./renderProject.mjs";
import fs from "node:fs";

const TMPL = fs.readFileSync("templates/project.html", "utf8");
const stubTax = (kind, key, loc) => ({ city: { riyadh: "الرياض" }, property_type: { townhouse: "تاون هاوس" } }[kind]?.[key] || key);

const sampleProject = {
  code: "najd-2", city_key: "riyadh", type_key: "townhouse", status: "available",
  price_min: 2200000, price_max: 2250000, image_url: "https://x/hero.jpg", brochure_url: "https://x/b.pdf",
  map_lat: 24.77, map_lng: 46.73,
  gallery: ["https://x/g1.jpg"],
  i18n: { title: { ar: "نجد ٢" }, district: { ar: "الرمال" }, description: { ar: "وصف المشروع" } },
  details: {
    facts: [{ label: { ar: "النوع" }, value: { ar: "تاون هاوس" } }],
    units: [{ title: { ar: "تاون هاوس ٣ غرف" }, description: { ar: "وحدة" }, gallery: ["https://x/u.jpg"], floorplan: "https://x/p.jpg" }],
    features: [{ ar: "مسبح" }],
    location: [{ ar: "قريب من المطار" }],
  },
};

test("renderProjectHtml assembles sections in the correct order", () => {
  const html = renderProjectHtml(TMPL, sampleProject, { loc: "ar", dir: "rtl", base: "https://rylist.sa", tax: stubTax, contact: {} });
  const iGallery = html.indexOf('class="pgallery"');
  const iDesc = html.indexOf("وصف المشروع");
  const iFacts = html.indexOf("تفاصيل المشروع");
  const iUnits = html.indexOf("الوحدات");
  const iFeatures = html.indexOf("المزايا والمرافق");
  const iMap = html.indexOf('class="psec pmap"');
  assert.ok(iGallery > -1 && iDesc > iGallery, "gallery before description");
  assert.ok(iFacts > iDesc, "facts after description");
  assert.ok(iUnits > iFacts, "units after facts");
  assert.ok(iFeatures > iUnits, "features after units");
  assert.ok(iMap > iFeatures, "map after features");
});

test("renderProjectHtml fills header fields and title", () => {
  const html = renderProjectHtml(TMPL, sampleProject, { loc: "ar", dir: "rtl", base: "https://rylist.sa", tax: stubTax, contact: {} });
  assert.match(html, /<title>نجد ٢ — RYLIST<\/title>/);
  assert.match(html, /2,200,000 – 2,250,000 ريال/);
  assert.match(html, /الرمال · تاون هاوس · الرياض/);
  assert.match(html, /q=24\.77,46\.73/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `renderProjectHtml is not a function`.

- [ ] **Step 3: Write minimal implementation** — append to `scripts/lib/renderProject.mjs`

```js
const CTA = { ar: "استفسر عبر واتساب", en: "Enquire on WhatsApp", zh: "通过 WhatsApp 咨询" };
const DL = { ar: "تحميل البروشور", en: "Download brochure", zh: "下载手册" };
const STATUS = {
  available: { ar: "متاح", en: "Available", zh: "可售" },
  reserved: { ar: "محجوز", en: "Reserved", zh: "已预订" },
  sold: { ar: "مباع", en: "Sold", zh: "已售" },
  soon: { ar: "قريبًا", en: "Soon", zh: "即将推出" },
};
const STATUS_CLASS = { sold: "status-pill--sold", reserved: "status-pill--reserved", soon: "status-pill--soon" };

// Assemble one full project page. `ctx` = { loc, dir, base, tax(kind,key,loc), contact }.
export function renderProjectHtml(tmpl, p, ctx) {
  const { loc, dir, base, tax } = ctx;
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
    assets: loc === "ar" ? ".." : "../..", home: loc === "ar" ? "/" : `/${loc}/`,
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — order + header tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/renderProject.mjs scripts/lib/renderProject.test.mjs
git commit -m "feat(project): full-page assembler renderProjectHtml + order test"
```

---

### Task 6: Rewrite `projectPages.mjs` as a thin loop + fixture build test

**Files:**
- Modify: `scripts/lib/projectPages.mjs`
- Modify: `scripts/lib/renderProject.test.mjs`

- [ ] **Step 1: Write the failing test** — append to `scripts/lib/renderProject.test.mjs`

```js
import { renderProjectPages } from "./projectPages.mjs";
import os from "node:os";
import path from "node:path";

test("renderProjectPages writes one file per project per locale", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rylist-build-"));
  const c = {
    locales: [{ code: "ar", dir: "rtl" }, { code: "en", dir: "ltr" }],
    taxonomies: [
      { kind: "city", key: "riyadh", i18n: { label: { ar: "الرياض", en: "Riyadh" } } },
      { kind: "property_type", key: "townhouse", i18n: { label: { ar: "تاون هاوس", en: "Townhouse" } } },
    ],
    contact: { whatsapp: "966500000000" },
    projects: [sampleProject],
  };
  renderProjectPages(out, c, "https://rylist.sa");
  const arFile = path.join(out, "projects", "najd-2.html");
  const enFile = path.join(out, "en", "projects", "najd-2.html");
  assert.ok(fs.existsSync(arFile), "ar file written");
  assert.ok(fs.existsSync(enFile), "en file written");
  const html = fs.readFileSync(arFile, "utf8");
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /class="punit-rich"/);   // rich units rendered
  fs.rmSync(out, { recursive: true, force: true });
});
```
> Reuses `sampleProject` defined in Task 5's test block.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — old `projectPages.mjs` still contains inline HTML logic and produces the OLD order / no `punit-rich` (sampleProject uses `units`, which old code ignores). Failure asserts on missing `punit-rich`.

- [ ] **Step 3: Rewrite** `scripts/lib/projectPages.mjs` **completely**

```js
import fs from "node:fs";
import { renderProjectHtml } from "./renderProject.mjs";

const tmpl = fs.readFileSync("templates/project.html", "utf8");

export function renderProjectPages(out, c, siteUrl) {
  const base = siteUrl.replace(/\/$/, "");
  const tax = (kind, key, loc) =>
    c.taxonomies.find((t) => t.kind === kind && t.key === key)?.i18n?.label?.[loc] || key;
  for (const L of c.locales) {
    const loc = L.code;
    const dir = loc === "ar" ? "" : `/${loc}`;
    const outDir = `${out}${dir}/projects`;
    fs.mkdirSync(outDir, { recursive: true });
    for (const p of c.projects) {
      const html = renderProjectHtml(tmpl, p, { loc, dir: L.dir, base, tax, contact: c.contact });
      fs.writeFileSync(`${outDir}/${p.code}.html`, "<!doctype html>\n" + html);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/projectPages.mjs scripts/lib/renderProject.test.mjs
git commit -m "refactor(project): projectPages is now a thin loop over renderProjectHtml"
```

---

### Task 7: CSS for rich units, floor plans, and map

**Files:**
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Append styles** to the end of `assets/css/styles.css` (after the existing `.pgallery__x` block near line 336)

```css
/* rich inline units (accordion) */
.punits-rich { display: flex; flex-direction: column; gap: var(--sp-3); }
.punit-rich { border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.punit-rich__sum { cursor: pointer; padding: var(--sp-4); font-weight: 600; color: var(--gold-deep); font-size: 1.05rem; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.punit-rich__sum::-webkit-details-marker { display: none; }
.punit-rich__sum::after { content: "+"; font-family: var(--font-mono); color: var(--text-mid); font-weight: 400; }
.punit-rich[open] .punit-rich__sum::after { content: "\2013"; }
.punit-rich__body { padding: 0 var(--sp-4) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-4); }
.punit-rich__desc { margin: 0; line-height: 1.9; color: var(--text-dark); }
.punit-rich__gallery, .pfloorplan__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--sp-3); }

/* unit floor plan */
.pfloorplan h4 { margin: 0 0 var(--sp-2); font-size: 0.95rem; color: var(--text-mid); }
.pfloorplan__cell { display: block; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--bg-soft); }
.pfloorplan__cell img { width: 100%; height: auto; display: block; }

/* map section */
.pmap__frame { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; border: 1px solid var(--line); background: var(--bg-soft); }
.pmap__frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pmap__nearttl { margin: var(--sp-4) 0 var(--sp-2); font-size: 1rem; }
```
> Verify these CSS vars exist earlier in the file (they are all already used above): `--sp-3 --sp-4 --line --radius --gold-deep --text-mid --text-dark --bg-soft --font-mono`. If `--font-mono` is absent, drop that one declaration.

- [ ] **Step 2: Sanity-check the vars referenced exist**

Run: `grep -oE "\-\-(sp-3|sp-4|line|radius|gold-deep|text-mid|text-dark|bg-soft|font-mono)\b" assets/css/styles.css | sort -u`
Expected: every referenced var name appears at least once (proof it's defined/used elsewhere).

- [ ] **Step 3: Commit**

```bash
git add assets/css/styles.css
git commit -m "style(project): rich units accordion, floor plans, map section"
```

---

### Task 8: Migration + admin fields + types

**Files:**
- Create: `supabase/migrations/0012_project_map_units.sql`
- Modify: `admin/entities.js`
- Modify: `supabase/types.ts`

- [ ] **Step 1: Create the migration** `supabase/migrations/0012_project_map_units.sql`

```sql
-- Per-project map coordinates (optional; the page falls back to a district search when null).
alter table public.projects add column if not exists map_lat double precision;
alter table public.projects add column if not exists map_lng double precision;

-- Rich units live inside the existing projects.details jsonb, alongside the legacy unitTypes:
--   details.units = [
--     { title:{ar,en}, description:{ar,en},
--       specs:[{label:{ar,en}, value:{ar,en}}],
--       gallery:["url"], floorplan:"url"  (or floorplans:["url"]) }
--   ]
-- When details.units is absent, the renderer falls back to the legacy details.unitTypes cards.
```

- [ ] **Step 2: Add admin fields** — in `admin/entities.js`, inside the `projects` entity `fields` array, insert after the `brochure_url` line (`{n:"brochure_url",t:"file",l:"البروشور (PDF)"},`):

```js
    {n:"map_lat",t:"number",l:"إحداثي العرض (Lat)",hint:"اختياري — كليك يمين على الموقع في Google Maps ثم انسخ الرقم الأول"},
    {n:"map_lng",t:"number",l:"إحداثي الطول (Lng)",hint:"اختياري — الرقم الثاني من الإحداثيات"},
```

- [ ] **Step 3: Update `supabase/types.ts`** — add `map_lat` / `map_lng` to the `projects` table's `Row`, `Insert`, and `Update` blocks (after each `image_url` line):

In `Row` (after `image_url: string | null`):
```ts
          map_lat: number | null
          map_lng: number | null
```
In `Insert` (after `image_url?: string | null`):
```ts
          map_lat?: number | null
          map_lng?: number | null
```
In `Update` (after `image_url?: string | null`):
```ts
          map_lat?: number | null
          map_lng?: number | null
```

- [ ] **Step 4: Re-run the test suite** (no logic changed, but confirm nothing broke)

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Apply the migration to the Supabase project**

The build's `fetchContent` does `select("*")`, so the site builds safely **even before** the columns exist (map just falls back to district). But the admin fields need the columns. Apply the migration to RYLIST's Supabase project via the Supabase MCP (`apply_migration` with the SQL above) or the Supabase dashboard SQL editor.
> ⚠️ Confirm WHICH Supabase project is RYLIST's before applying (there are multiple linked). Do not apply blindly.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_project_map_units.sql admin/entities.js supabase/types.ts
git commit -m "feat(db): project map_lat/map_lng columns + admin fields + types"
```

---

### Task 9: Full build verification + reference data (NAJD 2)

**Files:**
- (No code) — verification + optional data seed

- [ ] **Step 1: Confirm the whole suite passes**

Run: `npm test`
Expected: PASS — every test across Tasks 1–6.

- [ ] **Step 2: Real build smoke test (needs Supabase env)**

If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are available locally (`.env`), run:
Run: `node scripts/build.mjs`
Expected: `Build done → dist`. Then open `dist/projects/najd-2.html` and confirm section order: hero → gallery → description → facts → **units** → features → **map**. Existing NAJD projects (legacy `unitTypes`) show the old cards under "أنواع الوحدات" and a district-level map.
> If no local Supabase env, this runs in CI/Vercel on push — verify there instead.

- [ ] **Step 3: (Optional, needs source material) Seed rich units for NAJD 2**

To showcase the rich structure, populate `details.units` + `map_lat/map_lng` for `najd-2` from its brochure (unit descriptions + floor-plan images uploaded to Supabase storage). Write it as a one-off SQL `update public.projects set details = jsonb_set(...), map_lat = …, map_lng = … where code = 'najd-2';`, mirroring how gallery/details were seeded (migrations 0009/0010). This step is data, not code — do it when the floor-plan images and coordinates are in hand.

- [ ] **Step 4: Publish**

Follow the existing deploy path (memory: admin **نشر** button → publish edge fn → Vercel deploy hook), or `git push` to `main`. Confirm the live NAJD pages render the new order and the map.

---

## Self-Review

**Spec coverage:**
- Reorder (gallery→desc→facts→units→features→map) → Task 4 (template) + Task 5 (assembler order test). ✅
- Keep existing sections (facts, features, nearby) → factsHtml/featuresHtml (Task 3), location folded into map (Task 1). ✅
- Rich hierarchical units (gallery+desc+specs+floorplan), inline, expandable → unitsHtml (Task 2). ✅
- Floor plan lives inside each unit → unitsHtml `fpHtml`. ✅
- Backward compat with legacy `unitTypes` → unitsHtml fallback + test. ✅
- Maps keyless embed, coords with district fallback, always shown → mapHtml (Task 1). ✅
- Data model: `map_lat/map_lng` columns + `details.units` doc → Task 8 migration. ✅
- Admin map fields → Task 8. ✅
- Graceful empty (sections hide) → empty-string tests in Tasks 1–3. ✅
- No sidebar/TOC → nothing added; template has no nav. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows assertions. Task 9 Step 3 (data seed) is explicitly optional and dependent on external material — not a code placeholder. ✅

**Type/name consistency:** `lightboxCells` defined in Task 2, reused in Task 3. `tr`/`fill` defined Task 1, used throughout. `renderProjectHtml(tmpl, p, ctx)` signature matches its caller in Task 6. `sampleProject` defined in Task 5 test, reused in Task 6 test (tasks executed in order). Section id prefixes `g-`, `u-`, `fp-` are mutually unique. ✅
