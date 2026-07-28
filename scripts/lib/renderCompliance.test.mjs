import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { complianceHtml, saleTypeBadge } from "./renderCompliance.mjs";
import { FAL, ENTITY, DISCLAIMER } from "./compliance.mjs";

const FULL = {
  ad_license: "7200123456",
  plan_number: "3312",
  wafi_number: "WAFI-9911",
  sale_type: "offplan",
  property_status: "clear",
  developer_license: "1100223344",
  i18n: { developer: { ar: "ريبورتاج السعودية", en: "Reportage Saudi", zh: "Reportage 沙特" } },
};

// أهم حالة في الملف: هذه حال المشاريع الستة اليوم — لا رقم ترخيص إعلان ولا مخطط.
// عرض سطر فارغ (أو «—») مكان رقم ترخيص الإعلان يُقرأ إقرارًا مكتوبًا بغيابه.
test("مشروع بلا أي بيانات: لا يُطبع سطر ترخيص إعلان إطلاقًا", () => {
  const html = complianceHtml({}, "ar");
  assert.doesNotMatch(html, /رقم ترخيص الإعلان/);
  assert.doesNotMatch(html, /رقم المخطط/);
  assert.doesNotMatch(html, /رقم تسجيل المشروع/);
  assert.doesNotMatch(html, /حالة العقار/);
  assert.doesNotMatch(html, /المطوّر/);
  assert.doesNotMatch(html, /—/);
});

test("مشروع بلا بيانات: يبقى ما هو ثابت — فال والصفة وإخلاء المسؤولية", () => {
  const html = complianceHtml({}, "ar");
  assert.match(html, new RegExp(FAL.number));
  assert.match(html, new RegExp(ENTITY.name.ar));
  assert.match(html, new RegExp(ENTITY.capacity.ar));
  assert.match(html, /الصور تصوّر تصميمية/);
  assert.match(html, /<section class="psec pcompliance">/);
});

test("مشروع معبّأ: كل سطر يظهر بقيمته", () => {
  const html = complianceHtml(FULL, "ar");
  assert.match(html, /7200123456/);
  assert.match(html, /3312/);
  assert.match(html, /WAFI-9911/);
  assert.match(html, /1100223344/);
  assert.match(html, /ريبورتاج السعودية/);
  assert.match(html, /خالٍ من الرهن والنزاع/);
});

test("الحقول الفارغة تُقصى ولو كان غيرها معبّأً", () => {
  const html = complianceHtml({ ad_license: "7200123456" }, "ar");
  assert.match(html, /7200123456/);
  assert.doesNotMatch(html, /رقم المخطط/);
  assert.doesNotMatch(html, /المطوّر/);
});

test("المسافات البيضاء وحدها ليست قيمة", () => {
  const html = complianceHtml({ ad_license: "   ", i18n: { developer: { ar: "  " } } }, "ar");
  assert.doesNotMatch(html, /رقم ترخيص الإعلان/);
  assert.doesNotMatch(html, /المطوّر/);
});

test("رقم تسجيل المشروع يظهر للبيع على الخارطة", () => {
  const html = complianceHtml({ sale_type: "offplan", wafi_number: "WAFI-9911" }, "ar");
  assert.match(html, /WAFI-9911/);
});

test("الإنجليزية والصينية: لا تسرّب عربي في العناوين الثابتة", () => {
  const en = complianceHtml(FULL, "en");
  assert.match(en, /Advertising licence no\./);
  assert.match(en, new RegExp(ENTITY.capacity.en));
  assert.doesNotMatch(en, /رخصة فال/);

  const zh = complianceHtml(FULL, "zh");
  assert.match(zh, new RegExp(ENTITY.capacity.zh));
  assert.doesNotMatch(zh, /رخصة فال/);
});

test("المطوّر يسقط للعربية حين تغيب ترجمته", () => {
  const html = complianceHtml({ i18n: { developer: { ar: "ريبورتاج السعودية" } } }, "en");
  assert.match(html, /ريبورتاج السعودية/);
});

test("لغة غير معروفة تسقط للعربية بدل أن تُنتج فراغًا", () => {
  const html = complianceHtml(FULL, "fr");
  assert.match(html, new RegExp(ENTITY.capacity.ar));
});

test("رابط التحقق من فال موجود ويشير لصفحة الهيئة", () => {
  const html = complianceHtml({}, "ar");
  assert.match(html, new RegExp(FAL.verifyUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /rel="noopener"/);
});

test("القيم المحقونة تُهرَّب فلا تكسر الصفحة", () => {
  const html = complianceHtml({ ad_license: '<img src=x onerror="alert(1)">' }, "ar");
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test("saleTypeBadge: فارغ حين لا تصنيف، وشارة حين وُجد", () => {
  assert.equal(saleTypeBadge({}, "ar"), "");
  assert.equal(saleTypeBadge({ sale_type: "" }, "ar"), "");
  assert.match(saleTypeBadge({ sale_type: "offplan" }, "ar"), /على الخارطة/);
  assert.match(saleTypeBadge({ sale_type: "ready" }, "ar"), /جاهز/);
  assert.match(saleTypeBadge({ sale_type: "offplan" }, "en"), /Off-plan/);
});

test("قيمة تصنيف غير معروفة لا تُطبع شارة", () => {
  assert.equal(saleTypeBadge({ sale_type: "hacked" }, "ar"), "");
});

// الرقم مكتوب في مكانين: هذه الوحدة، وفوتر index.html (قابل للتحرير من الأدمن).
// هذا الاختبار يمنع تفرّعهما بصمت.
test("رقم فال في compliance.mjs يطابق المكتوب في فوتر index.html", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const m = html.match(/data-cms="fal_number">([^<]+)</);
  assert.ok(m, 'لم يُعثر على data-cms="fal_number" في index.html');
  assert.equal(m[1].trim(), FAL.number);
});

test("إخلاء المسؤولية مترجم للغات الثلاث", () => {
  for (const loc of ["ar", "en", "zh"]) assert.ok(DISCLAIMER[loc]?.trim());
});
