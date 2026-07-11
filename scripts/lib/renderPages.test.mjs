import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderPages } from "./renderPages.mjs";

function withTempIndex(html, run) {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rylist-rp-"));
  process.chdir(dir);
  try {
    fs.writeFileSync("index.html", html);
    run(dir);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SRC = `<!doctype html><html lang="ar" dir="rtl"><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&display=swap" rel="stylesheet">
</head><body>
<h1 data-cms="hero_title" data-en="Old EN">قديم</h1>
<div class="hero__bg" data-cms-img="hero" style="background-image:url('old.jpg')"></div>
</body></html>`;

test("renderPages overlays content + injects theme for ar", () => {
  withTempIndex(SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "ar", dir: "rtl" }],
      home: { i18n: { hero_title: { ar: "عنوان محدث" } }, hero_image_url: "https://cdn/new.jpg" },
      chrome: {}, theme: { font_preset: "elegant", accent_preset: "green" },
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /عنوان محدث/);
    assert.match(html, /background-image:url\('https:\/\/cdn\/new\.jpg'\)/);
    assert.match(html, /Playfair\+Display/);
    assert.match(html, /--champagne:\s*#4E6A4E/);
  });
});

test("renderPages keeps defaults when CMS empty", () => {
  withTempIndex(SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, { locales: [{ code: "ar", dir: "rtl" }], home: {}, chrome: {}, theme: {} }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /قديم/);
    assert.match(html, /Cormorant\+Garamond/);
  });
});

test("renderPages overlays DB text over the data-en default for en", () => {
  withTempIndex(SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "en", dir: "ltr" }],
      home: { i18n: { hero_title: { en: "DB English" } } },
      chrome: {}, theme: {},
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "en", "index.html"), "utf8");
    assert.match(html, /DB English/);
    // the data-en default was overridden in the RENDERED element text.
    // (the authoring `data-en="Old EN"` attribute itself is intentionally left in
    //  the output, same as every locale — so scope the check to element content.)
    assert.doesNotMatch(html, />Old EN</);
  });
});
