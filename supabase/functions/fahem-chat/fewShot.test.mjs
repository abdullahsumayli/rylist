import { test } from "node:test";
import assert from "node:assert/strict";
import { fewShot } from "./knowledge.ts";

// أقرب مثال للمحادثة الحقيقية هو أقواها أثرًا. لما كان آخر مثال عربي هو
// «حاب أزور» ← «اكتب لي رقم جوالك»، قلّده الموديل على أول تحية: طلب الجوال
// واخترع زيارة ما طلبها أحد. عولجت للإنجليزي والصيني في v30 وبقيت في العربي.
const asksForContact = (t) => /رقم جوالك|رقمك|phone number|جوالك هنا|电话|手机号/.test(t);
const inventsVisit = (t) => /أرتّب لك الزيارة|arrange (a |your )?visit|安排.*参观/.test(t);

for (const lang of ["ar", "en", "zh"]) {
  test(`[${lang}] no example ends the conversation by asking for contact details`, () => {
    const pairs = fewShot(lang);
    const last = pairs[pairs.length - 1];
    assert.equal(last.role, "assistant", "آخر مثال يجب أن يكون ردًّا لا سؤالًا معلّقًا");
    assert.ok(!asksForContact(last.content), `آخر مثال في ${lang} يطلب بيانات تواصل: ${last.content.slice(0, 70)}`);
  });

  test(`[${lang}] no assistant example asks for a phone number at all`, () => {
    const offenders = fewShot(lang)
      .filter((m) => m.role === "assistant" && asksForContact(m.content))
      .map((m) => m.content.slice(0, 60));
    assert.deepEqual(offenders, [], `أمثلة تطلب الجوال في ${lang}`);
  });

  test(`[${lang}] no assistant example invents a visit`, () => {
    const offenders = fewShot(lang)
      .filter((m) => m.role === "assistant" && inventsVisit(m.content))
      .map((m) => m.content.slice(0, 60));
    assert.deepEqual(offenders, [], `أمثلة تخترع زيارة في ${lang}`);
  });
}

// العربي كان يحتفظ بزوج زائد عن الإنجليزي، وهو بالضبط زوج الإغلاق المسيء.
test("every language gets the same set of examples, none keeps the closing pair", () => {
  assert.equal(fewShot("ar").length, fewShot("en").length);
  assert.equal(fewShot("en").length, fewShot("zh").length);
});

test("examples still alternate user then assistant", () => {
  for (const lang of ["ar", "en", "zh"]) {
    fewShot(lang).forEach((m, i) => {
      assert.equal(m.role, i % 2 === 0 ? "user" : "assistant", `[${lang}] الدور ${i} خارج الترتيب`);
    });
  }
});

test("the examples that teach honesty and policy are still there", () => {
  const ar = fewShot("ar").map((m) => m.content).join(" ");
  assert.ok(ar.includes("ما عندنا فلل"), "مثال الصدق عن المخزون الناقص");
  assert.ok(ar.includes("العمولة"), "مثال سؤال العمولة");
});
