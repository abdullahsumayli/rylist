import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { applyContent } from "./applyContent.mjs";

const maps = {
  text: {
    hero_title: { ar: "عنوان جديد", en: "New title" },
    nav_home: { ar: "الرئيسية٢", en: "Home2" },
  },
  heroImage: "https://cdn/x.jpg",
};

test("overlays DB text for the active locale", () => {
  const root = parse(`<h1 data-cms="hero_title">قديم</h1>`);
  applyContent(root, maps, "ar");
  assert.match(root.toString(), /عنوان جديد/);
  assert.doesNotMatch(root.toString(), /قديم/);
});

test("uses the locale-specific value", () => {
  const root = parse(`<h1 data-cms="hero_title">قديم</h1>`);
  applyContent(root, maps, "en");
  assert.match(root.toString(), /New title/);
});

test("keeps the default when key missing or value empty", () => {
  const root = parse(`<h1 data-cms="unknown">افتراضي</h1><h2 data-cms="hero_title"></h2>`);
  applyContent(root, { text: { hero_title: { ar: "" } }, heroImage: "" }, "ar");
  assert.match(root.toString(), /افتراضي/);
});

test("escapes HTML-special characters in overlaid text", () => {
  const root = parse(`<h1 data-cms="hero_title">x</h1>`);
  applyContent(root, { text: { hero_title: { ar: "A & B <c>" } }, heroImage: "" }, "ar");
  assert.match(root.toString(), /A &amp; B &lt;c&gt;/);
});

test("sets hero background image when provided", () => {
  const root = parse(`<div class="hero__bg" data-cms-img="hero" style="background-image:url('old.jpg')"></div>`);
  applyContent(root, maps, "ar");
  assert.match(root.toString(), /background-image:url\('https:\/\/cdn\/x\.jpg'\)/);
});

test("leaves hero image untouched when none provided", () => {
  const root = parse(`<div data-cms-img="hero" style="background-image:url('old.jpg')"></div>`);
  applyContent(root, { text: {}, heroImage: "" }, "ar");
  assert.match(root.toString(), /old\.jpg/);
});

test("sanitizes special characters in the hero image url", () => {
  const root = parse(`<div data-cms-img="hero" style="x"></div>`);
  applyContent(root, { text: {}, heroImage: "https://cdn/a'b.jpg" }, "ar");
  const html = root.toString();
  assert.match(html, /%27/);
  assert.doesNotMatch(html, /'\); /);
  assert.match(html, /background-image:url\(/);
});

// نسخة مطابقة لما في index.html (سطر الـ preload + عنصر الهيرو)
const HERO_HTML =
  `<link rel="preload" as="image" href="assets/img/hero-najdi.webp" type="image/webp" fetchpriority="high" data-cms-preload="hero">` +
  `<div class="hero__media" data-cms-img="hero" style="background-image:url('assets/img/hero-najdi.jpg');background-image:image-set(url('assets/img/hero-najdi.webp') type('image/webp'), url('assets/img/hero-najdi.jpg') type('image/jpeg'))"></div>`;

// الرابط المستخدم فعلًا في الخلفية — نقرأه من style حتى نقارنه بالـ preload
const usedImage = (root) => {
  const style = root.querySelector("[data-cms-img]").getAttribute("style");
  return style.match(/url\('([^']+)'\)/)[1];
};
const preload = (root) => root.querySelector("[data-cms-preload]");

test("preload href matches the admin image when one is set", () => {
  const root = parse(HERO_HTML);
  applyContent(root, { text: {}, heroImage: "https://cdn/hero.jpg" }, "ar");
  assert.equal(preload(root).getAttribute("href"), "https://cdn/hero.jpg");
  assert.equal(usedImage(root), "https://cdn/hero.jpg");
  // نوع الملف قد لا يكون webp بعد الآن
  assert.equal(preload(root).getAttribute("type"), undefined);
  // ما فيه إلا preload واحد ولا يشير للصورة الافتراضية
  assert.equal(root.querySelectorAll('link[rel="preload"]').length, 1);
  assert.doesNotMatch(root.toString(), /hero-najdi/);
});

test("preload href stays on the built-in image when no admin image", () => {
  const root = parse(HERO_HTML);
  applyContent(root, { text: {}, heroImage: "" }, "ar");
  assert.equal(preload(root).getAttribute("href"), "assets/img/hero-najdi.webp");
  assert.equal(preload(root).getAttribute("type"), "image/webp");
  // الـ preload يطابق نسخة webp داخل image-set الأصلي
  assert.match(root.querySelector("[data-cms-img]").getAttribute("style"), /image-set\(/);
  assert.match(root.toString(), /image-set\(url\('assets\/img\/hero-najdi\.webp'\) type\('image\/webp'\)/);
  assert.equal(usedImage(root), "assets/img/hero-najdi.jpg"); // الاحتياطي بقي كما هو
});

test("does not throw and keeps default when maps is missing", () => {
  const root = parse(`<h1 data-cms="x">افتراضي</h1>`);
  assert.doesNotThrow(() => applyContent(root, undefined, "ar"));
  assert.doesNotThrow(() => applyContent(root, null, "ar"));
  assert.match(root.toString(), /افتراضي/);
});
