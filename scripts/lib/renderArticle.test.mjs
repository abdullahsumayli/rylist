import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fmtDate, heroHtml, formatBody, renderArticleHtml } from "./renderArticle.mjs";
import { renderNewsPages } from "./newsPages.mjs";
import { resolveTheme } from "./theme.mjs";

const TMPL = fs.readFileSync("templates/article.html", "utf8");

const sampleNews = {
  slug: "riyadh-prices-2026",
  image_url: "https://x/hero.jpg",
  published_at: "2026-06-12T00:00:00+00:00",
  i18n: {
    title: { ar: "قراءة في الأسعار", en: "Reading prices" },
    category: { ar: "السوق", en: "Market" },
    excerpt: { ar: "ثلاثة عوامل", en: "Three factors" },
    body: { ar: "<p>الفقرة الأولى.</p><p>الفقرة الثانية.</p>", en: "<p>First.</p>" },
  },
};

test("formatBody turns plain-text blocks into paragraphs and drops a duplicated title", () => {
  const raw = "My Title\nFirst paragraph line one.\nline two.\n\nSecond paragraph.";
  const html = formatBody(raw, "My Title");
  assert.equal(html, "<p>First paragraph line one.<br>line two.</p><p>Second paragraph.</p>");
});

test("formatBody passes through existing HTML and escapes stray < & in plain text", () => {
  assert.equal(formatBody("<p>hi</p>", "t"), "<p>hi</p>");
  assert.match(formatBody("a < b & c", "t"), /a &lt; b &amp; c/);
  assert.equal(formatBody("", "t"), "");
});

test("heroHtml renders a figure only when an image is present", () => {
  assert.match(heroHtml("https://x/h.jpg", "alt"), /<figure class="pdetail__hero"><img src="https:\/\/x\/h\.jpg" alt="alt">/);
  assert.equal(heroHtml("", "alt"), "");
});

test("fmtDate returns the iso string as a fallback on bad input, empty for empty", () => {
  assert.equal(fmtDate("", "ar"), "");
  assert.match(fmtDate("2026-06-12", "en"), /2026/);
});

test("renderArticleHtml fills title, category, excerpt and injects body raw", () => {
  const html = renderArticleHtml(TMPL, sampleNews, { loc: "ar", dir: "rtl", base: "https://rylist.sa" });
  assert.match(html, /<title>قراءة في الأسعار — RYLIST<\/title>/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /class="article-card__cat">السوق/);
  assert.match(html, /class="adetail__lead">ثلاثة عوامل/);
  assert.match(html, /<p>الفقرة الأولى\.<\/p><p>الفقرة الثانية\.<\/p>/);   // body injected as HTML
  assert.match(html, /class="pdetail__hero"/);
  assert.match(html, /rel="canonical" href="https:\/\/rylist\.sa\/news\/riyadh-prices-2026\.html"/);
});

test("renderArticleHtml back link and asset depth follow the locale", () => {
  const ar = renderArticleHtml(TMPL, sampleNews, { loc: "ar", dir: "rtl", base: "https://rylist.sa" });
  assert.match(ar, /href="\/news\.html"/);
  assert.match(ar, /href="\.\.\/assets\/css\/styles\.css"/);
  const en = renderArticleHtml(TMPL, sampleNews, { loc: "en", dir: "ltr", base: "https://rylist.sa" });
  assert.match(en, /href="\/en\/news\.html"/);
  assert.match(en, /href="\.\.\/\.\.\/assets\/css\/styles\.css"/);
  assert.match(en, /rel="canonical" href="https:\/\/rylist\.sa\/en\/news\/riyadh-prices-2026\.html"/);
});

test("renderArticleHtml falls back to the excerpt when body is empty", () => {
  const noBody = { ...sampleNews, i18n: { ...sampleNews.i18n, body: {} } };
  const html = renderArticleHtml(TMPL, noBody, { loc: "ar", dir: "rtl", base: "https://rylist.sa" });
  const bodyStart = html.indexOf('class="adetail__body"');
  assert.ok(html.indexOf("ثلاثة عوامل", bodyStart) > bodyStart, "excerpt used as body fallback");
});

test("renderArticleHtml derives the meta description from body and omits the lead when no excerpt", () => {
  const noExcerpt = { ...sampleNews, i18n: { ...sampleNews.i18n, excerpt: {} } };
  const html = renderArticleHtml(TMPL, noExcerpt, { loc: "ar", dir: "rtl", base: "https://rylist.sa" });
  assert.doesNotMatch(html, /class="adetail__lead"/);              // no auto-blurb above the body
  assert.match(html, /name="description" content="الفقرة الأولى\./);  // meta derived from body, HTML stripped
  assert.doesNotMatch(html, /content="[^"]*<p>/);                  // tags stripped from meta
});

test("renderArticleHtml injects theme head when a theme is provided, no placeholder when absent", () => {
  const theme = resolveTheme({ font_preset: "elegant", accent_preset: "green" });
  const themed = renderArticleHtml(TMPL, sampleNews, { loc: "ar", dir: "rtl", base: "https://rylist.sa", theme });
  assert.match(themed, /<style id="theme-vars">:root\{/);
  const plain = renderArticleHtml(TMPL, sampleNews, { loc: "ar", dir: "rtl", base: "https://rylist.sa" });
  assert.doesNotMatch(plain, /\{\{themeHead\}\}/);
});

test("renderNewsPages writes one file per article per locale, skipping slugless rows", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rylist-news-"));
  const c = {
    locales: [{ code: "ar", dir: "rtl" }, { code: "en", dir: "ltr" }],
    news: [sampleNews, { slug: "", i18n: { title: { ar: "بدون معرّف" } } }],
  };
  renderNewsPages(out, c, "https://rylist.sa");
  const arFile = path.join(out, "news", "riyadh-prices-2026.html");
  const enFile = path.join(out, "en", "news", "riyadh-prices-2026.html");
  assert.ok(fs.existsSync(arFile), "ar file written");
  assert.ok(fs.existsSync(enFile), "en file written");
  const html = fs.readFileSync(arFile, "utf8");
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html.slice(20), /<!doctype html>/i);   // no duplicated doctype
  fs.rmSync(out, { recursive: true, force: true });
});
