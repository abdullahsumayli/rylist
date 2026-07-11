import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHtml } from "./renderProject.mjs";
import { unitsHtml } from "./renderProject.mjs";

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
