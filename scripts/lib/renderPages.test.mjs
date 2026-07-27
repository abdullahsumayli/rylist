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

const HERO_SRC = `<!doctype html><html lang="ar" dir="rtl"><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="assets/img/hero-najdi.webp" type="image/webp" data-cms-preload="hero">
</head><body>
<div data-cms-img="hero" style="background-image:url('assets/img/hero-najdi.jpg');background-image:image-set(url('assets/img/hero-najdi.webp') type('image/webp'), url('assets/img/hero-najdi.jpg') type('image/jpeg'))"></div>
</body></html>`;

// localized pages live under /<locale>/, so a relative url() inside `style` would
// resolve to /en/assets/... — the CSS background must be made root-relative too,
// exactly like the [href],[src] pass, or the hero 404s on every non-ar page.
test("renderPages makes style url() root-relative for non-ar locales", () => {
  withTempIndex(HERO_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, { locales: [{ code: "en", dir: "ltr" }], home: {}, chrome: {}, theme: {} }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "en", "index.html"), "utf8");
    assert.match(html, /url\('\/assets\/img\/hero-najdi\.jpg'\)/);
    assert.match(html, /image-set\(url\('\/assets\/img\/hero-najdi\.webp'\) type\('image\/webp'\)/);
    assert.doesNotMatch(html, /url\('assets\//); // ما بقي أي مسار نسبي
    // الـ preload لازم يطابق ما تحمّله CSS فعلًا
    assert.match(html, /href="\/assets\/img\/hero-najdi\.webp"/);
  });
});

test("renderPages leaves style url() relative for ar (page sits at the root)", () => {
  withTempIndex(HERO_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, { locales: [{ code: "ar", dir: "rtl" }], home: {}, chrome: {}, theme: {} }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /url\('assets\/img\/hero-najdi\.jpg'\)/);
    assert.match(html, /href="assets\/img\/hero-najdi\.webp"/);
  });
});

test("renderPages: admin hero image wins over the relative-url rewrite", () => {
  withTempIndex(HERO_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "en", dir: "ltr" }],
      home: { hero_image_url: "https://cdn/admin-hero.png" }, chrome: {}, theme: {},
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "en", "index.html"), "utf8");
    assert.match(html, /background-image:url\('https:\/\/cdn\/admin-hero\.png'\)/);
    assert.match(html, /href="https:\/\/cdn\/admin-hero\.png"/);
    assert.doesNotMatch(html, /hero-najdi/); // ما فيه تنزيل مهدور
  });
});

// حقل الصورة في لوحة التحكم مربّع نصّي حر، فقد يُكتب فيه مسار نسبي بدل رابط
// مطلق. لازم يمرّ على نفس تصحيح المسارات، وإلا انكسر الهيرو في /en/ و/zh/.
test("renderPages root-relativizes a RELATIVE admin hero url for non-ar", () => {
  withTempIndex(HERO_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "en", dir: "ltr" }],
      home: { hero_image_url: "assets/img/custom-hero.jpg" }, chrome: {}, theme: {},
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "en", "index.html"), "utf8");
    assert.match(html, /background-image:url\('\/assets\/img\/custom-hero\.jpg'\)/);
    assert.match(html, /href="\/assets\/img\/custom-hero\.jpg"/);
    assert.doesNotMatch(html, /url\('assets\//);
  });
});

test("renderPages leaves a relative admin hero url alone for ar", () => {
  withTempIndex(HERO_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "ar", dir: "rtl" }],
      home: { hero_image_url: "assets/img/custom-hero.jpg" }, chrome: {}, theme: {},
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /background-image:url\('assets\/img\/custom-hero\.jpg'\)/);
    assert.match(html, /href="assets\/img\/custom-hero\.jpg"/);
  });
});

test("renderPages never rewrites an absolute admin hero url", () => {
  withTempIndex(HERO_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "en", dir: "ltr" }],
      home: { hero_image_url: "https://cdn.supabase.co/media/home/1-hero.jpg" }, chrome: {}, theme: {},
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "en", "index.html"), "utf8");
    assert.match(html, /url\('https:\/\/cdn\.supabase\.co\/media\/home\/1-hero\.jpg'\)/);
    assert.match(html, /href="https:\/\/cdn\.supabase\.co\/media\/home\/1-hero\.jpg"/);
  });
});

function withTempPage(filename, html, run) {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rylist-rp-"));
  process.chdir(dir);
  try {
    fs.writeFileSync(filename, html);
    run(dir);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const ABOUT_SRC = `<!doctype html><html lang="ar" dir="rtl"><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&display=swap" rel="stylesheet">
</head><body>
<h1 data-cms="about_title" data-en="Old EN">قديم</h1>
</body></html>`;

test("renderPages overlays about_content onto about.html", () => {
  withTempPage("about.html", ABOUT_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, {
      locales: [{ code: "ar", dir: "rtl" }],
      home: {}, chrome: {}, theme: {},
      about: { i18n: { about_title: { ar: "من نحن الجديد" } } },
    }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "about.html"), "utf8");
    assert.match(html, /من نحن الجديد/);
  });
});

test("renderPages keeps about.html default when about_content empty", () => {
  withTempPage("about.html", ABOUT_SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, { locales: [{ code: "ar", dir: "rtl" }], home: {}, chrome: {}, theme: {} }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "about.html"), "utf8");
    assert.match(html, /قديم/);
  });
});
