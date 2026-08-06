import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMessage } from "./fahemMarkdown.js";

// النموذج يكتب أسماء المشاريع بخط عريض. قبل هذا الإصلاح كان المستخدم يرى النجمات نفسها.
test("bold markdown becomes a strong tag", () => {
  assert.equal(renderMessage("**نجد ٥** في الجنادرية"), "<strong>نجد ٥</strong> في الجنادرية");
});

test("several bold spans in one message all convert", () => {
  assert.equal(
    renderMessage("**نجد ٢** و**نجد ٣**"),
    "<strong>نجد ٢</strong> و<strong>نجد ٣</strong>"
  );
});

// الأهم أمنيًا: نص النموذج يُهرَّب قبل أي تحويل، فلا يمكن حقن HTML عبر الرد.
test("html in the model output is escaped, never executed", () => {
  assert.equal(
    renderMessage('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("html inside a bold span is escaped too", () => {
  assert.equal(renderMessage("**<b>x</b>**"), "<strong>&lt;b&gt;x&lt;/b&gt;</strong>");
});

test("ampersands stay escaped", () => {
  assert.equal(renderMessage("Fahem & RYLIST"), "Fahem &amp; RYLIST");
});

// نجمة يتيمة تبقى كما هي بدل أن تبتلع بقية الرسالة.
test("an unmatched marker is left literal", () => {
  assert.equal(renderMessage("سعر **مميز"), "سعر **مميز");
  assert.equal(renderMessage("**"), "**");
});

// بدون هذا القيد، رسالة فيها نجمتان في فقرتين مختلفتين تُدمج فقرة واحدة عريضة.
test("bold does not span across lines", () => {
  assert.equal(renderMessage("**أول\nثاني**"), "**أول\nثاني**");
});

test("empty bold markers are not turned into an empty tag", () => {
  assert.equal(renderMessage("****"), "****");
});

test("newlines survive untouched for pre-wrap to render", () => {
  assert.equal(renderMessage("سطر\n\nسطر"), "سطر\n\nسطر");
});

test("null and undefined render as empty string", () => {
  assert.equal(renderMessage(null), "");
  assert.equal(renderMessage(undefined), "");
  assert.equal(renderMessage(""), "");
});
