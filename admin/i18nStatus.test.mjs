import test from "node:test";
import assert from "node:assert/strict";
import { textOf, localeGaps, isComplete, gapsSentence } from "./i18nStatus.js";

const KEYS = [{ key: "title", label: "العنوان" }, { key: "body", label: "المقال" }];
const CODES = ["ar", "en", "zh"];
const NAMES = { ar: "العربي", en: "الإنجليزي", zh: "الصيني" };

const full = () => ({
  title: { ar: "عنوان", en: "Title", zh: "标题" },
  body: { ar: "<p>نص</p>", en: "<p>Body</p>", zh: "<p>正文</p>" },
});

test("textOf strips tags and entities down to real text", () => {
  assert.equal(textOf("<p>نص</p>"), "نص");
  assert.equal(textOf("<p><br></p>"), "");
  assert.equal(textOf("&nbsp; &nbsp;"), "");
  assert.equal(textOf(null), "");
  assert.equal(textOf("<div> a <b>b</b> </div>"), "a b");
});

test("a fully translated article has no gaps", () => {
  assert.deepEqual(localeGaps(full(), KEYS, CODES), {});
  assert.equal(isComplete(full(), KEYS, CODES), true);
});

test("an empty rich-text body counts as missing, not as content", () => {
  const a = full();
  a.body.zh = "<p><br></p>";
  assert.deepEqual(localeGaps(a, KEYS, CODES), { zh: ["المقال"] });
  assert.equal(isComplete(a, KEYS, CODES), false);
});

test("whitespace-only text counts as missing", () => {
  const a = full();
  a.title.en = "   ";
  assert.deepEqual(localeGaps(a, KEYS, CODES), { en: ["العنوان"] });
});

test("a language missing everything lists every field", () => {
  const a = full();
  delete a.title.zh; delete a.body.zh;
  assert.deepEqual(localeGaps(a, KEYS, CODES), { zh: ["العنوان", "المقال"] });
});

test("an Arabic-only article reports both other languages", () => {
  const a = { title: { ar: "عنوان" }, body: { ar: "<p>نص</p>" } };
  assert.deepEqual(localeGaps(a, KEYS, CODES), { en: ["العنوان", "المقال"], zh: ["العنوان", "المقال"] });
});

test("a missing or empty i18n object is handled, not thrown on", () => {
  assert.equal(isComplete(undefined, KEYS, CODES), false);
  assert.equal(isComplete({}, KEYS, CODES), false);
  assert.deepEqual(Object.keys(localeGaps({}, KEYS, CODES)), CODES);
});

test("gapsSentence names the language and its missing fields in Arabic", () => {
  const gaps = { en: ["المقال"], zh: ["العنوان", "المقال"] };
  assert.equal(gapsSentence(gaps, NAMES), "الإنجليزي (المقال)، الصيني (العنوان والمقال)");
});

test("gapsSentence of no gaps is empty", () => {
  assert.equal(gapsSentence({}, NAMES), "");
});
