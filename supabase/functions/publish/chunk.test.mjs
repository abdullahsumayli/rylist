import test from "node:test";
import assert from "node:assert/strict";
import { splitBlocks, splitParagraphs, chunkForTranslation } from "./chunk.mjs";

// النص الأصلي مقدّس: أي تقسيم يجب أن يرجع النص حرفًا بحرف عند الربط، وإلا فسدت المقالة.
const lossless = (chunks, original) => assert.equal(chunks.join(""), original);

test("short text is returned as a single chunk", () => {
  assert.deepEqual(chunkForTranslation("<p>مرحبًا</p>", 1800), ["<p>مرحبًا</p>"]);
});

test("empty or whitespace-only text yields no chunks", () => {
  assert.deepEqual(chunkForTranslation("", 100), []);
  assert.deepEqual(chunkForTranslation("   \n  ", 100), []);
});

test("splitBlocks cuts after each top-level block end", () => {
  const html = "<p>واحد</p><h2>عنوان</h2><p>اثنان</p>";
  assert.deepEqual(splitBlocks(html), ["<p>واحد</p>", "<h2>عنوان</h2>", "<p>اثنان</p>"]);
  lossless(splitBlocks(html), html);
});

test("a list is never split apart at its items", () => {
  const html = "<p>قبل</p><ul><li>أ</li><li>ب</li></ul><p>بعد</p>";
  assert.deepEqual(splitBlocks(html), ["<p>قبل</p>", "<ul><li>أ</li><li>ب</li></ul>", "<p>بعد</p>"]);
});

test("a <p> nested inside a table cell never becomes a split point", () => {
  const html = "<table><tbody><tr><td><p>خلية</p></td></tr></tbody></table><p>بعد</p>";
  assert.deepEqual(splitBlocks(html), ["<table><tbody><tr><td><p>خلية</p></td></tr></tbody></table>", "<p>بعد</p>"]);
});

test("nested lists close to depth zero before splitting", () => {
  const html = "<ul><li>أ<ul><li>ب</li></ul></li></ul><p>بعد</p>";
  assert.deepEqual(splitBlocks(html), ["<ul><li>أ<ul><li>ب</li></ul></li></ul>", "<p>بعد</p>"]);
});

test("trailing text after the last block is kept", () => {
  const html = "<p>واحد</p>ذيل";
  lossless(splitBlocks(html), html);
  assert.deepEqual(splitBlocks(html), ["<p>واحد</p>", "ذيل"]);
});

test("a single long HTML line with no newlines still chunks", () => {
  const para = "<p>" + "ن".repeat(400) + "</p>";
  const html = para.repeat(10);                       // ~4100 حرف، بلا أي سطر جديد
  const chunks = chunkForTranslation(html, 1000);
  assert.ok(chunks.length > 3, `expected several chunks, got ${chunks.length}`);
  lossless(chunks, html);
  for (const c of chunks) assert.ok(c.startsWith("<p>") && c.endsWith("</p>"));
});

test("chunks stay under the limit when blocks allow it", () => {
  const html = ("<p>" + "ن".repeat(200) + "</p>").repeat(20);
  const chunks = chunkForTranslation(html, 1000);
  for (const c of chunks) assert.ok(c.length <= 1000, `chunk of ${c.length} exceeds 1000`);
  lossless(chunks, html);
});

test("a single block larger than the limit is kept whole rather than cut", () => {
  const html = "<p>" + "ن".repeat(3000) + "</p><p>قصير</p>";
  const chunks = chunkForTranslation(html, 1000);
  assert.equal(chunks[0], "<p>" + "ن".repeat(3000) + "</p>");
  lossless(chunks, html);
});

test("plain text splits on blank lines and rejoins exactly", () => {
  const text = ("فقرة طويلة ".repeat(30) + "\n\n").repeat(6);
  const chunks = chunkForTranslation(text, 800);
  assert.ok(chunks.length > 1);
  lossless(chunks, text);
});

test("plain text with only single newlines splits on them", () => {
  const text = Array.from({ length: 12 }, (_, i) => `سطر ${i} ` + "ن".repeat(200)).join("\n");
  const chunks = chunkForTranslation(text, 700);
  assert.ok(chunks.length > 1);
  lossless(chunks, text);
});

test("splitParagraphs keeps separators attached so joining is lossless", () => {
  const text = "أ\n\nب\nج";
  lossless(splitParagraphs(text), text);
});

test("unsplittable long text falls back to one chunk instead of corrupting", () => {
  const text = "ن".repeat(5000);                      // بلا وسوم ولا أسطر
  assert.deepEqual(chunkForTranslation(text, 1000), [text]);
});

test("malformed HTML with an unclosed container is not split", () => {
  const html = "<ul><li>أ</li>" + "ن".repeat(3000);   // <ul> ما انغلق
  const chunks = chunkForTranslation(html, 500);
  lossless(chunks, html);
});
