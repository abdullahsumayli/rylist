import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFooter } from "./footerPartial.mjs";
import { FAL } from "./compliance.mjs";

const CONTACT = { whatsapp: "966508148860", email: "info@rylist.sa", phone: "+966 50 814 8860" };
const CONTENT = { text: {} };
const ar = () => buildFooter({ locale: "ar", contact: CONTACT, content: CONTENT, year: 2026 });
const en = () => buildFooter({ locale: "en", contact: CONTACT, content: CONTENT, year: 2026 });

test("الفوتر يحمل بيانات الترخيص كاملة", () => {
  const html = ar();
  assert.match(html, new RegExp(FAL.number));
  assert.match(html, /تحقّق من الرخصة/);
  assert.match(html, /class="site-footer/);
});

// البند ٦: الرقم النائب كان مكتوبًا حرفيًا في المصدر ولا يُستبدل إلا بعد
// تشغيل جافاسكربت — وصفحات المشاريع لا تحمّل جافاسكربت الموقع أصلًا.
test("رقم الهاتف حقيقي في المصدر، والنائب مختفٍ", () => {
  const html = ar();
  assert.match(html, /\+966 50 814 8860/);
  assert.match(html, /href="tel:\+966508148860"/);
  assert.doesNotMatch(html, /000 0000/);
});

test("واتساب والبريد والسنة مملوءة وقت البناء", () => {
  const html = ar();
  assert.match(html, /https:\/\/wa\.me\/966508148860\?text=/);
  assert.match(html, /mailto:info@rylist\.sa/);
  assert.match(html, />2026</);
});

test("رسالة واتساب تتبع لغة الصفحة", () => {
  assert.match(en(), new RegExp(encodeURIComponent("Hello RYLIST, I have an inquiry.").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("مسارات الأصول جذرية فلا تنكسر على أي عمق", () => {
  const html = ar();
  assert.match(html, /src="\/assets\/img\/licenses\/fal-rega\.png"/);
  assert.doesNotMatch(html, /src="assets\//);
  assert.doesNotMatch(html, /href="assets\//);
});

test("روابط الصفحات جذرية وتحترم مجلد اللغة", () => {
  assert.match(ar(), /href="\/projects\.html"/);
  assert.match(en(), /href="\/en\/projects\.html"/);
  assert.doesNotMatch(en(), /href="projects\.html"/);
});

test("شعار الفوتر يعود لجذر اللغة لا لملف index.html", () => {
  assert.match(ar(), /href="\/"/);
  assert.match(en(), /href="\/en\/"/);
});

test("الروابط الخارجية لا تُمسّ", () => {
  assert.match(ar(), new RegExp(FAL.verifyUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("الإنجليزية تُبدَّل نصوصها ولا يتسرّب العربي", () => {
  const html = en();
  assert.match(html, /All rights reserved/);
  assert.match(html, /Privacy Policy/);
  assert.doesNotMatch(html, /جميع الحقوق محفوظة/);
});

test("محتوى قاعدة البيانات يتغلّب على النص الافتراضي", () => {
  const html = buildFooter({
    locale: "ar", contact: CONTACT, year: 2026,
    content: { text: { footer_rights: { ar: "كل الحقوق محفوظة لرايليست" } } },
  });
  assert.match(html, /كل الحقوق محفوظة لرايليست/);
});

test("غياب بيانات التواصل لا يُسقط البناء", () => {
  const html = buildFooter({ locale: "ar", contact: {}, content: CONTENT, year: 2026 });
  assert.match(html, /class="site-footer/);
});

test("إخلاء المسؤولية عن الصور والأسعار موجود في الفوتر", () => {
  assert.match(ar(), /الصور تصوّر تصميمية/);
});

test("بيانات المنشأة مخفيّة بلا أرقام، وتظهر أول ما تُعبّأ", () => {
  const hidden = ar();
  assert.match(hidden, /class="footer-entity"[^>]*hidden/);

  const shown = buildFooter({
    locale: "ar", contact: CONTACT, year: 2026,
    content: { text: { cr_number: { ar: "1010123456" } } },
  });
  assert.doesNotMatch(shown, /class="footer-entity"[^>]*hidden/);
  assert.match(shown, /1010123456/);
});
