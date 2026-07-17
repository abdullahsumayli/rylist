import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mapHtml, unitsHtml, galleryHtml, factsHtml, featuresHtml, renderProjectHtml } from "./renderProject.mjs";
import { renderProjectPages } from "./projectPages.mjs";
import { resolveTheme } from "./theme.mjs";

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

const richUnit = {
  title: { ar: "تاون هاوس ٣ غرف", en: "3-bed townhouse" },
  price: { ar: "٢٬٢٠٠٬٠٠٠ ريال", en: "SAR 2,200,000" },
  description: { ar: "وحدة فاخرة", en: "Luxury unit" },
  specs: [{ label: { ar: "المساحة" }, value: { ar: "٢٠٠ م²" } }],
  gallery: ["https://x/u1.jpg", "https://x/u2.jpg"],
  floorplan: "https://x/plan1.jpg",
};

test("unitsHtml renders rich units as a card grid (all visible, no accordion)", () => {
  const html = unitsHtml({ units: [richUnit, { title: { ar: "٤ غرف" } }] }, "najd-2", "ar");
  assert.match(html, /<div class="grid grid-3 punits-grid">/);
  assert.match(html, /<article class="punit-card">/);
  assert.doesNotMatch(html, /<details/);                            // no accordion — all visible
  assert.match(html, /class="punit-card__price"/);                  // price shown per unit
  assert.match(html, /٢٬٢٠٠٬٠٠٠ ريال/);
  assert.match(html, /تاون هاوس ٣ غرف/);
  assert.match(html, /وحدة فاخرة/);
  assert.match(html, /٢٠٠ م²/);
});

test("unitsHtml shows the floor-plan image inside the card, but not the gallery photo", () => {
  const html = unitsHtml({ units: [richUnit] }, "najd-2", "ar");
  assert.doesNotMatch(html, /class="punit-card__media"/);   // no unit gallery photo
  assert.doesNotMatch(html, /u1\.jpg|u2\.jpg/);             // gallery URLs not emitted
  assert.match(html, /class="punit-card__plan"/);           // floor-plan image shown
  assert.match(html, /plan1\.jpg/);                          // floor-plan URL emitted
  assert.match(html, /id="fp-najd-2-0-0"/);                  // floor-plan lightbox overlay
  assert.match(html, /المخطط/);
});

test("unitsHtml renders floor plan from a floorplans array", () => {
  const html = unitsHtml({ units: [{ title: { ar: "أ" }, floorplans: ["https://x/a.jpg", "https://x/b.jpg"] }] }, "p", "ar");
  assert.match(html, /a\.jpg/);
  assert.match(html, /id="fp-p-0-0"/);
  assert.match(html, /class="punit-card"/);
});

test("unitsHtml skips blank template models (empty slots never render)", () => {
  const blank = { title: { ar: "", en: "", zh: "" }, price: { ar: "" }, description: { ar: "" }, specs: [], gallery: [], floorplan: "" };
  const html = unitsHtml({ units: [richUnit, blank, blank, blank] }, "najd-2", "ar");
  const cards = (html.match(/class="punit-card"/g) || []).length;
  assert.equal(cards, 1);   // only the filled model renders
});

test("unitsHtml returns empty string when every model is a blank template", () => {
  const blank = { title: { ar: "" }, price: { ar: "" }, specs: [], floorplan: "" };
  assert.equal(unitsHtml({ units: [blank, blank, blank, blank] }, "p", "ar"), "");
});

test("unitsHtml falls back to legacy unitTypes cards when no units", () => {
  const html = unitsHtml({ unitTypes: [{ title: { ar: "٣ غرف" }, detail: { ar: "تفاصيل" } }] }, "p", "ar");
  assert.match(html, /class="punit"/);
  assert.match(html, /أنواع الوحدات/);
  assert.match(html, /٣ غرف/);
  assert.doesNotMatch(html, /punit-rich/);
});

test("unitsHtml renders unitType images as lightbox thumbs", () => {
  const html = unitsHtml({ unitTypes: [
    { title: { ar: "٣ غرف" }, detail: { ar: "تفاصيل" }, images: ["https://x/a.jpg", "", "https://x/b.jpg"] },
  ] }, "p", "ar");
  assert.match(html, /class="punit__imgs"/);
  assert.match(html, /href="#ut-p-0-0"/);          // first image lightbox link
  assert.match(html, /id="ut-p-0-1"/);             // second image overlay (blank url skipped)
  assert.match(html, /https:\/\/x\/b\.jpg/);
  assert.doesNotMatch(html, /src=""/);             // blank url filtered out, no empty img
});

test("unitsHtml legacy cards omit image markup when no images", () => {
  const html = unitsHtml({ unitTypes: [{ title: { ar: "٣ غرف" }, detail: { ar: "تفاصيل" } }] }, "p", "ar");
  assert.doesNotMatch(html, /punit__imgs/);
});

test("unitsHtml returns empty string when no unit data at all", () => {
  assert.equal(unitsHtml({}, "p", "ar"), "");
  assert.equal(unitsHtml({ units: [] }, "p", "ar"), "");
});

test("galleryHtml renders grid + lightbox, empty when no images", () => {
  const html = galleryHtml(["https://x/1.jpg"], "najd-2", "نجد ٢", "ar");
  assert.match(html, /class="pgallery"/);
  assert.match(html, /معرض الصور/);
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
  // Anchor on the wrapping class, not the raw description text: the same text is
  // also mirrored into the <head> <meta name="description"> tag (correct, existing
  // SEO behavior — see projectPages.mjs), so a raw-text search matches the <head>
  // occurrence first and misreports order.
  const iDesc = html.indexOf('class="pdetail__desc"');
  const iFacts = html.indexOf("تفاصيل المشروع");
  const iUnits = html.indexOf("النماذج");
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
  assert.match(html, /dir="rtl"/);
  assert.match(html, /2,200,000 – 2,250,000 ريال/);
  assert.match(html, /الرمال · تاون هاوس · الرياض/);
  assert.match(html, /q=24\.77,46\.73/);
});

test("renderProjectHtml injects theme head when a theme is provided", () => {
  const theme = resolveTheme({ font_preset: "elegant", accent_preset: "green" });
  const html = renderProjectHtml(TMPL, sampleProject, { loc: "ar", dir: "rtl", base: "https://rylist.sa", tax: stubTax, contact: {}, theme });
  assert.match(html, /<style id="theme-vars">:root\{/);
  assert.match(html, /--champagne:\s*#4E6A4E/);
  assert.match(html, /family=Playfair\+Display/);
});

test("renderProjectHtml leaves no themeHead placeholder when theme absent", () => {
  const html = renderProjectHtml(TMPL, sampleProject, { loc: "ar", dir: "rtl", base: "https://rylist.sa", tax: stubTax, contact: {} });
  assert.doesNotMatch(html, /\{\{themeHead\}\}/);   // placeholder cleanly removed
});

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
  assert.match(html, /class="punit-card"/);   // rich unit cards rendered
  fs.rmSync(out, { recursive: true, force: true });
});
