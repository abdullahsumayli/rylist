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
