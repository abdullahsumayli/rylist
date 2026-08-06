import { test } from "node:test";
import assert from "node:assert/strict";
import { foundLine } from "./countedNoun.mjs";

// العربية تعدّ بثلاث صيغ لا صيغة واحدة: مفرد، مثنّى، ثم جمع بعدد مكتوب.
// الصيغة القديمة كانت `هذي ${n} مشاريع` فتُخرج «هذي 2 مشاريع»: رقم غربي ومعدود غلط.
test("one project uses the singular, and the singular verb", () => {
  assert.equal(foundLine(1, "الرياض", "ar"), "أبشر! لقيت لك مشروعًا يناسب طلبك في الرياض:");
});

test("two projects use the dual, never the digit 2", () => {
  const out = foundLine(2, "الرياض", "ar");
  assert.equal(out, "أبشر! لقيت لك مشروعين يناسبان طلبك في الرياض:");
  assert.ok(!/2/.test(out), "لا يجوز ظهور رقم غربي في نص عربي");
});

// مشروع مذكّر، فعدده من ٣ إلى ١٠ يُؤنَّث (ثلاثة لا ثلاث)، والمعدود جمع.
test("three to five use a spelled-out number with the plural", () => {
  assert.equal(foundLine(3, "الرياض", "ar"), "أبشر! لقيت لك ثلاثة مشاريع تناسب طلبك في الرياض:");
  assert.equal(foundLine(4, "جدة", "ar"), "أبشر! لقيت لك أربعة مشاريع تناسب طلبك في جدة:");
  assert.equal(foundLine(5, "الرياض", "ar"), "أبشر! لقيت لك خمسة مشاريع تناسب طلبك في الرياض:");
});

test("no Arabic line ever contains a Western digit", () => {
  for (let n = 1; n <= 10; n++) {
    assert.ok(!/[0-9]/.test(foundLine(n, "الرياض", "ar")), `العدد ${n} سرّب رقمًا غربيًا`);
  }
});

// الصينية تستبدل 二 بـ 两 قبل المصنّف، فـ«2 个项目» تُقرأ ركيكة.
test("chinese uses 两 before the classifier, not the digit", () => {
  assert.equal(foundLine(2, "利雅得", "zh"), "好的！这是利雅得符合您需求的两个项目：");
  assert.equal(foundLine(1, "利雅得", "zh"), "好的！我在利雅得为您找到一个符合需求的项目：");
  assert.equal(foundLine(3, "利雅得", "zh"), "好的！这是利雅得符合您需求的 3 个项目：");
});

test("english pluralises the noun and the verb together", () => {
  assert.equal(foundLine(1, "Riyadh", "en"), "Here is 1 matching project in Riyadh:");
  assert.equal(foundLine(2, "Riyadh", "en"), "Here are 2 matching projects in Riyadh:");
});

// المخزون قد يكبر ويتجاوز أسماء الأعداد المكتوبة؛ لا نريد انهيارًا ولا "undefined مشاريع".
test("counts past the spelled-out range still read correctly", () => {
  const out = foundLine(12, "الرياض", "ar");
  assert.ok(!/undefined/.test(out));
  assert.ok(out.includes("مشروعًا"), "ما بعد العشرة تمييزه مفرد منصوب");
});
