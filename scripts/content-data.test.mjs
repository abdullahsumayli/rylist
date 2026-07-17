import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, blankI18n, blankPair, blankUnit, blankUnitType, unitHasContent } from "../admin/content-data.js";

test("buildPayload preserves untouched details keys", () => {
  const draft = { gallery: [], details: { unitTypes: [{ a: 1 }], custom: "keep" } };
  const { details } = buildPayload(draft);
  assert.deepEqual(details.unitTypes, [{ a: 1 }]);
  assert.equal(details.custom, "keep");
});

test("buildPayload filters empty/whitespace gallery urls", () => {
  const draft = { gallery: ["a", "", "   ", "b"], details: {} };
  assert.deepEqual(buildPayload(draft).gallery, ["a", "b"]);
});

test("buildPayload tolerates missing gallery/details", () => {
  const { gallery, details } = buildPayload({});
  assert.deepEqual(gallery, []);
  assert.deepEqual(details, {});
});

test("unitHasContent detects filled vs blank template models", () => {
  assert.equal(unitHasContent(blankUnit()), false);
  assert.equal(unitHasContent({ title: { ar: "نموذج أ" } }), true);
  assert.equal(unitHasContent({ price: { en: "SAR 1M" } }), true);
  assert.equal(unitHasContent({ specs: [{ label: { ar: "المساحة" }, value: { ar: "٢٠٠" } }] }), true);
  assert.equal(unitHasContent({ floorplan: "https://x/p.jpg" }), true);
  assert.equal(unitHasContent({ floorplans: ["https://x/p.jpg"] }), true);
  assert.equal(unitHasContent({ title: { ar: "  " }, price: { ar: "" }, specs: [] }), false);
});

test("buildPayload strips blank model templates, keeps filled ones", () => {
  const draft = { gallery: [], details: { units: [
    { title: { ar: "تاون هاوس" }, price: { ar: "٢ مليون" } },
    blankUnit(), blankUnit(), blankUnit(),
  ] } };
  const { details } = buildPayload(draft);
  assert.equal(details.units.length, 1);
  assert.equal(details.units[0].title.ar, "تاون هاوس");
});

test("buildPayload leaves details.units untouched when key absent", () => {
  const { details } = buildPayload({ gallery: [], details: { facts: [{ a: 1 }] } });
  assert.equal(details.units, undefined);
  assert.deepEqual(details.facts, [{ a: 1 }]);
});

test("blank factories produce the trilingual shapes", () => {
  assert.deepEqual(blankI18n(), { ar: "", en: "", zh: "" });
  assert.deepEqual(Object.keys(blankPair()).sort(), ["label", "value"]);
  assert.deepEqual(Object.keys(blankUnitType()).sort(), ["detail", "images", "title"]);
  assert.deepEqual(Object.keys(blankUnit()).sort(), ["description", "floorplan", "gallery", "price", "specs", "title"]);
});
