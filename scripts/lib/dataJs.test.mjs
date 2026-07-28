import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeDataJs } from "./dataJs.mjs";

// assets/js/data.js ملف عام يحمّله كل زائر. `window.RYLIST_DATA` كان يصبّ صفوف
// المشاريع خامًا، فتخرج معها روابط البروشورات رغم أن الصفحات نفسها لا تربطها.
const sampleContent = () => ({
  locales: ["ar"], taxonomies: [], news: [], partners: [], stats: [], social: [],
  contact: { whatsapp: "966500000000", i18n: {} },
  projects: [{
    id: "1", code: "NAJD-2", city_key: "riyadh", type_key: "townhouse", status: "available",
    price_min: 2200000, price_max: 2250000, area: "250–273", beds_min: 3, beds_max: 4,
    image_url: "https://x/hero.jpg",
    brochure_url: "https://x/storage/najd2-brochure.pdf",
    i18n: { title: { ar: "نجد ٢" }, district: { ar: "الرمال" } },
    details: { brochure_on_request: true, facts: [] },
    gallery: [],
  }],
});

const build = (content) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rylist-datajs-"));
  writeDataJs(out, content);
  const js = fs.readFileSync(path.join(out, "assets/js/data.js"), "utf8");
  fs.rmSync(out, { recursive: true, force: true });
  return js;
};

test("data.js never leaks a brochure URL to the public bundle", () => {
  const js = build(sampleContent());
  assert.doesNotMatch(js, /brochure_url/);
  assert.doesNotMatch(js, /\.pdf/);
});

test("data.js still carries what the front-end actually renders", () => {
  const js = build(sampleContent());
  // الحقول التي تقرؤها main.js/public.js تبقى كما هي — الحذف يخصّ البروشور وحده
  for (const field of ["NAJD-2", "RYLIST_DATA", "hero.jpg", "2200000", "الرمال"]) {
    assert.ok(js.includes(field), `data.js فقد ${field}`);
  }
  // ويبقى العلم الذي يقرّر ظهور زر «اطلب البروشور» عند بناء صفحة المشروع
  assert.match(js, /brochure_on_request/);
});
