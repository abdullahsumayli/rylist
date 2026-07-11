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
