import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, blankI18n, blankPair, blankUnit, blankUnitType } from "../admin/content-data.js";

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

test("blank factories produce the trilingual shapes", () => {
  assert.deepEqual(blankI18n(), { ar: "", en: "", zh: "" });
  assert.deepEqual(Object.keys(blankPair()).sort(), ["label", "value"]);
  assert.deepEqual(Object.keys(blankUnitType()).sort(), ["detail", "title"]);
  assert.deepEqual(Object.keys(blankUnit()).sort(), ["description", "floorplan", "gallery", "price", "specs", "title"]);
});
