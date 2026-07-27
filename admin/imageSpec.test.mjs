import { test } from "node:test";
import assert from "node:assert/strict";
import { checkImageSpec, fmtBytes } from "./imageSpec.js";

const KB = 1024;
const HERO = { maxKB: 600, minW: 1200, recW: 1600, recH: 900 };
const LOGO = { maxKB: 200, maxW: 600, maxH: 400, recW: 240, recH: 120 };

test("no spec means no complaint", () => {
  assert.equal(checkImageSpec(null, 9e9, { w: 1, h: 1 }), null);
  assert.equal(checkImageSpec(undefined, 9e9, { w: 1, h: 1 }), null);
});

test("a well-sized hero photo passes", () => {
  assert.equal(checkImageSpec(HERO, 400 * KB, { w: 1600, h: 900 }), null);
});

// الحالة التي كسرت الهيرو فعلًا: شعار 1.3KB صغير جدًا يُمدّ بـ background-size:cover
test("rejects an image narrower than minW even when the file is tiny", () => {
  const r = checkImageSpec(HERO, 1338, { w: 240, h: 120 });
  assert.ok(r, "a 240px-wide logo must not pass as a hero");
  assert.match(r.need, /عرض ≥ 1200px/);
  assert.match(r.has, /240×120px/);
});

test("rejects a hero over the size budget", () => {
  const r = checkImageSpec(HERO, 900 * KB, { w: 2400, h: 1350 });
  assert.ok(r);
  assert.match(r.need, /≤ 600KB/);
  assert.match(r.has, /900 KB/);
});

test("a large hero within budget is fine (no maxW on heroes)", () => {
  assert.equal(checkImageSpec(HERO, 500 * KB, { w: 3200, h: 1800 }), null);
});

test("logo spec still rejects oversized dimensions", () => {
  const r = checkImageSpec(LOGO, 10 * KB, { w: 900, h: 500 });
  assert.ok(r);
  assert.match(r.need, /~240×120px/);
});

test("logo spec passes a proper logo", () => {
  assert.equal(checkImageSpec(LOGO, 8 * KB, { w: 240, h: 120 }), null);
});

// SVG وملفات لا تُقاس أبعادها: نتخطّى فحص الأبعاد ونبقي فحص الحجم
test("unmeasurable dimensions skip dimension checks but keep the size check", () => {
  assert.equal(checkImageSpec(HERO, 100 * KB, { w: 0, h: 0 }), null);
  const r = checkImageSpec(HERO, 700 * KB, { w: 0, h: 0 });
  assert.ok(r);
  assert.doesNotMatch(r.has, /×/); // ما نذكر أبعادًا لا نعرفها
});

test("missing dims object does not throw", () => {
  assert.doesNotThrow(() => checkImageSpec(HERO, 100 * KB, undefined));
});

test("fmtBytes switches to MB past a megabyte", () => {
  assert.equal(fmtBytes(500 * KB), "500 KB");
  assert.equal(fmtBytes(2 * 1048576), "2.0 MB");
});
