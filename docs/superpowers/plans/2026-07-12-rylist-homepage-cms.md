# Homepage CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin full control over all homepage text, shared header/footer text, the hero background image, and site theme (curated font + accent-color presets) — edited in the admin panel, published via the existing build.

**Architecture:** Content-key overlay on the existing static HTML. Editable elements get a `data-cms="<key>"` attribute; the hardcoded Arabic/`data-en`/`data-zh` text stays as a fallback. At build time, after the per-locale text swap, a new `applyContent()` overlays DB values when present. Theme presets override the CSS custom properties already defined in `styles.css` (`--font-ar-body`, `--champagne`, …) by injecting a `<style>` block and swapping the Google Fonts `<link>`.

**Tech Stack:** Node ESM build scripts, `node-html-parser`, `node:test`, Supabase (Postgres + RLS), vanilla-JS admin.

**Spec:** [docs/superpowers/specs/2026-07-12-rylist-homepage-cms-design.md](../specs/2026-07-12-rylist-homepage-cms-design.md)

---

## File Structure

**New files**
- `supabase/migrations/0013_home_content.sql` — 3 tables + RLS + seed rows.
- `scripts/lib/theme.mjs` — font/accent preset maps + `resolveTheme()`.
- `scripts/lib/theme.test.mjs` — unit tests for `resolveTheme()`.
- `scripts/lib/applyContent.mjs` — `applyContent(root, maps, locale)` overlay.
- `scripts/lib/applyContent.test.mjs` — unit tests for the overlay.

**Modified files**
- `scripts/lib/fetchContent.mjs` — fetch the 3 new single-row tables.
- `scripts/lib/renderPages.mjs` — build maps + call `applyContent()` + inject theme.
- `index.html` — `data-cms` on homepage body + `data-cms-img` on hero + `data-cms` on header/footer.
- `projects.html`, `services.html`, `about.html`, `news.html`, `contact.html` — `data-cms` on the shared header/footer only.
- `admin/entities.js` — 3 new entities.
- `admin/app.js` — icons for the 3 new entities.

**Key reference — CSS variables the theme overrides** (already defined in `assets/css/styles.css:32-35` and `:15-19`):
`--font-en-display`, `--font-en-body`, `--font-ar-display`, `--font-ar-body` (fonts); `--champagne`, `--gold-deep`, `--gold-bright`, `--pale` (accent). No CSS refactor needed — these already exist.

**CMS key list** (single flat namespace; `home_content.i18n` + `site_chrome.i18n` keys are disjoint and merged at build):

- Hero: `hero_title`, `hero_lead`, `hero_cta1`, `hero_cta2`
- Search: `search_eyebrow`
- Services: `svc_eyebrow`, `svc_head`, `svc1_title`, `svc1_desc`, `svc2_title`, `svc2_desc`, `svc3_title`, `svc3_desc`
- Featured: `feat_eyebrow`, `feat_head`, `feat_link`
- Partners: `partners_eyebrow`
- Why: `why_eyebrow`, `why_head`, `why_lead`, `why_cta`, `why1_title`, `why1_desc`, `why2_title`, `why2_desc`, `why3_title`, `why3_desc`
- CTA band: `cta_head`, `cta_lead`, `cta_primary`, `cta_wa`
- Chrome (header): `nav_home`, `nav_projects`, `nav_services`, `nav_about`, `nav_news`, `nav_contact`, `nav_cta`, `topbar_city`
- Chrome (footer): `footer_tag`, `footer_explore_head`, `footer_contact_head`, `footer_bottom`, `footer_rights`

---

## Task 1: Database migration (3 tables + RLS + seed)

**Files:**
- Create: `supabase/migrations/0013_home_content.sql`

Mirrors the `contact` single-row pattern (`supabase/migrations/0002_content_tables.sql:66-73`) and the RLS style used by the other content tables (public read, admin write via `public.is_admin()` from `supabase/migrations/0004_admins.sql`).

- [ ] **Step 1: Write the migration**

```sql
-- 0013_home_content.sql — محتوى الصفحة الرئيسية + الهيدر/الفوتر + المظهر (كلها صف واحد id=1)

-- نصوص جسم الصفحة الرئيسية + صورة الهيرو
create table if not exists public.home_content (
  id             int primary key default 1 check (id = 1),
  hero_image_url text,
  i18n           jsonb not null default '{}'::jsonb,   -- { hero_title:{ar,en,zh}, ... }
  updated_at     timestamptz not null default now()
);
create trigger trg_home_content_updated before update on public.home_content
  for each row execute function public.set_updated_at();

-- نصوص الهيدر/الفوتر المشتركة
create table if not exists public.site_chrome (
  id         int primary key default 1 check (id = 1),
  i18n       jsonb not null default '{}'::jsonb,        -- { nav_home:{...}, footer_tag:{...}, ... }
  updated_at timestamptz not null default now()
);
create trigger trg_site_chrome_updated before update on public.site_chrome
  for each row execute function public.set_updated_at();

-- المظهر: معرّفات مجموعات جاهزة
create table if not exists public.site_theme (
  id            int primary key default 1 check (id = 1),
  font_preset   text not null default 'classic',
  accent_preset text not null default 'gold',
  updated_at    timestamptz not null default now()
);
create trigger trg_site_theme_updated before update on public.site_theme
  for each row execute function public.set_updated_at();

-- صفوف البذرة (فارغة النصوص = يبقى الافتراضي في HTML)
insert into public.home_content (id) values (1) on conflict (id) do nothing;
insert into public.site_chrome  (id) values (1) on conflict (id) do nothing;
insert into public.site_theme   (id) values (1) on conflict (id) do nothing;

-- RLS: قراءة عامة، كتابة للأدمن فقط
alter table public.home_content enable row level security;
alter table public.site_chrome  enable row level security;
alter table public.site_theme   enable row level security;

create policy "home_content read"  on public.home_content for select using (true);
create policy "home_content write" on public.home_content for all
  using (public.is_admin()) with check (public.is_admin());

create policy "site_chrome read"   on public.site_chrome for select using (true);
create policy "site_chrome write"  on public.site_chrome for all
  using (public.is_admin()) with check (public.is_admin());

create policy "site_theme read"    on public.site_theme for select using (true);
create policy "site_theme write"   on public.site_theme for all
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Apply the migration to the rylist Supabase project**

Apply via the Supabase MCP tool `apply_migration` (project ref `ghtcwsbtyvczlznviojj`, name `0013_home_content`). Do NOT hand-run against prod without approval.

Expected: three tables created, three seed rows (`select id from home_content` → `1`).

- [ ] **Step 3: Verify RLS + seed**

Run (via MCP `execute_sql`): `select count(*) from home_content; select count(*) from site_chrome; select count(*) from site_theme;`
Expected: each returns `1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0013_home_content.sql
git commit -m "feat(db): home_content/site_chrome/site_theme tables for homepage CMS"
```

---

## Task 2: Theme presets + resolver (`theme.mjs`)

**Files:**
- Create: `scripts/lib/theme.mjs`
- Test: `scripts/lib/theme.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/lib/theme.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, FONT_PRESETS, ACCENT_PRESETS } from "./theme.mjs";

test("resolveTheme returns classic/gold defaults when row is empty", () => {
  const t = resolveTheme({});
  assert.match(t.href, /Cormorant\+Garamond/);
  assert.match(t.vars, /--champagne:\s*#A38A58/);
  assert.match(t.vars, /--font-ar-body:/);
});

test("resolveTheme applies a chosen font + accent preset", () => {
  const t = resolveTheme({ font_preset: "elegant", accent_preset: "green" });
  assert.match(t.href, /Playfair\+Display/);
  assert.match(t.href, /Tajawal/);
  assert.match(t.vars, /--champagne:\s*#4E6A4E/);
});

test("resolveTheme falls back to defaults for unknown ids", () => {
  const t = resolveTheme({ font_preset: "nope", accent_preset: "nope" });
  assert.match(t.href, /Cormorant\+Garamond/);
  assert.match(t.vars, /--champagne:\s*#A38A58/);
});

test("every preset id is present in the exported maps", () => {
  assert.deepEqual(Object.keys(FONT_PRESETS), ["classic", "modern", "elegant", "simple"]);
  assert.deepEqual(Object.keys(ACCENT_PRESETS), ["gold", "green", "navy", "charcoal", "burgundy"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/theme.test.mjs`
Expected: FAIL — `Cannot find module './theme.mjs'`.

- [ ] **Step 3: Write `theme.mjs`**

```js
// scripts/lib/theme.mjs
// المصدر الوحيد لقيم المظهر. معرّفات هذه الخرائط يجب أن تطابق options في admin/entities.js.
const MONO = "family=IBM+Plex+Mono:wght@400;500";
const G = (families) => `https://fonts.googleapis.com/css2?${families}&${MONO}&display=swap`;

export const FONT_PRESETS = {
  classic: {
    label: "الترف الكلاسيكي",
    href: G("family=Cormorant+Garamond:wght@400;500&family=Hanken+Grotesk:wght@300;400;500;600&family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600"),
    vars: {
      "--font-en-display": '"Cormorant Garamond", Georgia, serif',
      "--font-en-body": '"Hanken Grotesk", system-ui, sans-serif',
      "--font-ar-display": '"Amiri", "Times New Roman", serif',
      "--font-ar-body": '"IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif',
    },
  },
  modern: {
    label: "عصري",
    href: G("family=Hanken+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600"),
    vars: {
      "--font-en-display": '"Hanken Grotesk", system-ui, sans-serif',
      "--font-en-body": '"Hanken Grotesk", system-ui, sans-serif',
      "--font-ar-display": '"IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif',
      "--font-ar-body": '"IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif',
    },
  },
  elegant: {
    label: "أنيق",
    href: G("family=Playfair+Display:wght@400;500;600&family=Tajawal:wght@300;400;500;700"),
    vars: {
      "--font-en-display": '"Playfair Display", Georgia, serif',
      "--font-en-body": '"Tajawal", system-ui, sans-serif',
      "--font-ar-display": '"Tajawal", system-ui, sans-serif',
      "--font-ar-body": '"Tajawal", system-ui, Tahoma, sans-serif',
    },
  },
  simple: {
    label: "بسيط",
    href: G("family=Inter:wght@300;400;500;600&family=Cairo:wght@300;400;600;700"),
    vars: {
      "--font-en-display": '"Inter", system-ui, sans-serif',
      "--font-en-body": '"Inter", system-ui, sans-serif',
      "--font-ar-display": '"Cairo", system-ui, sans-serif',
      "--font-ar-body": '"Cairo", system-ui, Tahoma, sans-serif',
    },
  },
};

export const ACCENT_PRESETS = {
  gold:     { label: "ذهبي",      vars: { "--champagne": "#A38A58", "--gold-deep": "#86713F", "--gold-bright": "#BBA476", "--pale": "#D2C19C" } },
  green:    { label: "أخضر عميق", vars: { "--champagne": "#4E6A4E", "--gold-deep": "#3C523C", "--gold-bright": "#6E8A6E", "--pale": "#AEC2AE" } },
  navy:     { label: "كحلي",      vars: { "--champagne": "#3B4E6B", "--gold-deep": "#2C3B52", "--gold-bright": "#5E739A", "--pale": "#A9B8CE" } },
  charcoal: { label: "فحمي",      vars: { "--champagne": "#55524C", "--gold-deep": "#3A3833", "--gold-bright": "#7A756C", "--pale": "#BFB9AE" } },
  burgundy: { label: "نبيذي",     vars: { "--champagne": "#7A3B4B", "--gold-deep": "#5A2C38", "--gold-bright": "#9A5E6E", "--pale": "#CFA9B4" } },
};

// resolveTheme(row) -> { href, vars } — href = Google Fonts URL, vars = CSS declarations for :root
export function resolveTheme(row = {}) {
  const font = FONT_PRESETS[row?.font_preset] || FONT_PRESETS.classic;
  const accent = ACCENT_PRESETS[row?.accent_preset] || ACCENT_PRESETS.gold;
  const all = { ...font.vars, ...accent.vars };
  const vars = Object.entries(all).map(([k, v]) => `${k}: ${v};`).join(" ");
  return { href: font.href, vars };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/theme.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/theme.mjs scripts/lib/theme.test.mjs
git commit -m "feat(build): curated font + accent theme presets"
```

---

## Task 3: Content overlay (`applyContent.mjs`)

**Files:**
- Create: `scripts/lib/applyContent.mjs`
- Test: `scripts/lib/applyContent.test.mjs`

`applyContent(root, maps, locale)` — `root` is a `node-html-parser` root, `maps = { text: {key:{ar,en,zh}}, heroImage: "" }`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/lib/applyContent.test.mjs
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/applyContent.test.mjs`
Expected: FAIL — `Cannot find module './applyContent.mjs'`.

- [ ] **Step 3: Write `applyContent.mjs`**

```js
// scripts/lib/applyContent.mjs
// يراكب محتوى قاعدة البيانات على العناصر المُعلَّمة بـ data-cms / data-cms-img.
// إن كانت القيمة فارغة/غائبة يبقى النص الافتراضي المكتوب في HTML (احتياط + SEO).
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export function applyContent(root, maps, locale) {
  const text = (maps && maps.text) || {};
  root.querySelectorAll("[data-cms]").forEach((el) => {
    const key = el.getAttribute("data-cms");
    const val = text[key] && text[key][locale];
    if (val != null && String(val).trim() !== "") el.set_content(esc(val));
  });
  const img = maps && maps.heroImage;
  if (img && String(img).trim() !== "") {
    root.querySelectorAll("[data-cms-img]").forEach((el) => {
      el.setAttribute("style", `background-image:url('${img}')`);
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/applyContent.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applyContent.mjs scripts/lib/applyContent.test.mjs
git commit -m "feat(build): applyContent overlay for CMS-annotated elements"
```

---

## Task 4: Fetch new tables (`fetchContent.mjs`)

**Files:**
- Modify: `scripts/lib/fetchContent.mjs`

- [ ] **Step 1: Add single-row fetches + return them**

Replace the body of `fetchContent` so the final return includes the three new single-row rows. The current file ends at `scripts/lib/fetchContent.mjs:11-14` (contact + pages + return). Add, right after the `contact` line:

```js
  const single = async (t) => (await sb.from(t).select("*").eq("id", 1).maybeSingle()).data || {};
  const [home, chrome, theme] = await Promise.all([
    single("home_content"), single("site_chrome"), single("site_theme"),
  ]);
```

And extend the returned object (currently `return { locales: ..., ..., contact, pages };`) to also include:

```js
           contact, pages, home, chrome, theme };
```

- [ ] **Step 2: Verify it parses (no unit test — integration covered in Task 5/8)**

Run: `node -e "import('./scripts/lib/fetchContent.mjs').then(()=>console.log('ok'))"`
Expected: prints `ok` (module loads; it won't connect without env vars, that's fine).

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/fetchContent.mjs
git commit -m "feat(build): fetch home_content/site_chrome/site_theme"
```

---

## Task 5: Wire overlay + theme into `renderPages.mjs`

**Files:**
- Modify: `scripts/lib/renderPages.mjs`

- [ ] **Step 1: Import the new libs**

At the top of `scripts/lib/renderPages.mjs` (after the existing import on line 1):

```js
import { applyContent } from "./applyContent.mjs";
import { resolveTheme } from "./theme.mjs";
```

- [ ] **Step 2: Thread content + theme through `localizeHtml`**

Change the `localizeHtml` signature to accept `content` and `theme`:

```js
function localizeHtml(html, locale, dir, siteUrl, pageName, content, theme){
```

Inside `localizeHtml`, immediately AFTER the `if(locale !== "ar"){ ... }` block that does the `data-<locale>` swaps (ends at `scripts/lib/renderPages.mjs:23`), insert:

```js
  // overlay DB content (after locale swap so DB overrides the per-language default)
  applyContent(root, content, locale);
```

Then, after the `head` is captured (`const head = root.querySelector("head");`, line 25) insert the theme injection:

```js
  // theme: swap the Google Fonts link + override CSS variables
  const fontLink = head.querySelector('link[href*="fonts.googleapis.com/css2"]');
  if(fontLink && theme?.href) fontLink.setAttribute("href", theme.href);
  if(theme?.vars) head.insertAdjacentHTML("beforeend", `\n<style id="theme-vars">:root{${theme.vars}}</style>`);
```

- [ ] **Step 3: Build the maps once in `renderPages` and pass them down**

In `renderPages(out, c, siteUrl)`, before the `for(const page of PAGES)` loop, add:

```js
  const content = {
    text: { ...(c.home?.i18n || {}), ...(c.chrome?.i18n || {}) },
    heroImage: c.home?.hero_image_url || "",
  };
  const theme = resolveTheme(c.theme || {});
```

And update the `localizeHtml` call inside the loop (currently `scripts/lib/renderPages.mjs:41`) to pass them:

```js
      fs.writeFileSync(`${outDir}/${page}`, localizeHtml(src, L.code, L.dir, siteUrl, page, content, theme));
```

- [ ] **Step 4: Write an integration test**

Create `scripts/lib/renderPages.test.mjs`:

```js
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
    assert.match(html, /Playfair\+Display/);        // theme font swapped
    assert.match(html, /--champagne:\s*#4E6A4E/);   // theme accent injected
  });
});

test("renderPages keeps defaults when CMS empty", () => {
  withTempIndex(SRC, (dir) => {
    const out = path.join(dir, "dist");
    renderPages(out, { locales: [{ code: "ar", dir: "rtl" }], home: {}, chrome: {}, theme: {} }, "https://rylist.sa");
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /قديم/);                     // default text preserved
    assert.match(html, /Cormorant\+Garamond/);      // default font
  });
});
```

- [ ] **Step 5: Run tests**

Run: `node --test scripts/lib/renderPages.test.mjs`
Expected: PASS (2 tests). If `renderPages` writes to `dist` relative to cwd, the test's `process.chdir` + absolute `out` handles it.

- [ ] **Step 6: Run the whole build-lib suite**

Run: `node --test scripts/lib/`
Expected: all tests pass (existing `renderProject.test.mjs` + the 3 new files).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/renderPages.mjs scripts/lib/renderPages.test.mjs
git commit -m "feat(build): overlay CMS content + inject theme in renderPages"
```

---

## Task 6: Annotate `index.html` (homepage body + hero image)

**Files:**
- Modify: `index.html`

Add `data-cms="<key>"` to each element below (keep existing text + `data-en`/`data-zh`). Line numbers are from the current file.

- [ ] **Step 1: Hero + search + services**

- `index.html:57` hero bg `<div class="hero__bg" ...>` → add `data-cms-img="hero"`.
- `index.html:59` `<h1 class="display" ...>` → `data-cms="hero_title"`.
- `index.html:60` `<p class="lead" ...>` → `data-cms="hero_lead"`.
- `index.html:62` primary hero `<a>` → `data-cms="hero_cta1"`.
- `index.html:63` ghost hero `<a>` → `data-cms="hero_cta2"`.
- `index.html:71` search `<span class="eyebrow">` → `data-cms="search_eyebrow"`.
- `index.html:94` services `<span class="eyebrow">` → `data-cms="svc_eyebrow"`.
- `index.html:95` services `<h2>` → `data-cms="svc_head"`.
- `index.html:101` `<h3>` → `data-cms="svc1_title"`; `:102` `<p>` → `data-cms="svc1_desc"`.
- `index.html:107` `<h3>` → `data-cms="svc2_title"`; `:108` `<p>` → `data-cms="svc2_desc"`.
- `index.html:113` `<h3>` → `data-cms="svc3_title"`; `:114` `<p>` → `data-cms="svc3_desc"`.

- [ ] **Step 2: Featured + partners + why + CTA**

- `index.html:125` featured `<span class="eyebrow">` → `data-cms="feat_eyebrow"`.
- `index.html:126` featured `<h2>` → `data-cms="feat_head"`.
- `index.html:128` `<a class="link-arrow">` → `data-cms="feat_link"`.
- `index.html:137` partners `<span class="eyebrow">` → `data-cms="partners_eyebrow"`.
- `index.html:146` why `<span class="eyebrow">` → `data-cms="why_eyebrow"`.
- `index.html:147` why `<h2>` → `data-cms="why_head"`.
- `index.html:148` why `<p class="lead">` → `data-cms="why_lead"`.
- `index.html:149` why `<a class="btn btn--ghost">` → `data-cms="why_cta"`.
- `index.html:152` value 1 `<h3>` → `data-cms="why1_title"`, its `<p>` → `data-cms="why1_desc"`.
- `index.html:153` value 2 `<h3>` → `data-cms="why2_title"`, its `<p>` → `data-cms="why2_desc"`.
- `index.html:154` value 3 `<h3>` → `data-cms="why3_title"`, its `<p>` → `data-cms="why3_desc"`.
- `index.html:163` CTA `<h2 class="h1">` → `data-cms="cta_head"`.
- `index.html:164` CTA `<p class="lead">` → `data-cms="cta_lead"`.
- `index.html:165` CTA primary `<a>` → `data-cms="cta_primary"`; CTA whatsapp `<a>` → `data-cms="cta_wa"`.

Note: `why1_desc`/`why2_desc`/`why3_desc` target the `<p>` inside each `.value` (`index.html:152-154`). Each `.value` has one `<h3>` and one `<p>`; annotate both.

- [ ] **Step 3: Header + footer in index.html** (shared keys — Task 7 repeats these in the other pages)

- `index.html:25` `<span class="topbar__group--muted">` → `data-cms="topbar_city"`.
- `index.html:41-46` nav links → `data-cms="nav_home"`, `nav_projects`, `nav_services`, `nav_about`, `nav_news`, `nav_contact` (in order).
- `index.html:47` `<a class="btn btn--primary nav__cta">` → `data-cms="nav_cta"`.
- `index.html:180` footer `<p class="site-footer__tag">` → `data-cms="footer_tag"`.
- `index.html:183` footer `<h4>` (Explore) → `data-cms="footer_explore_head"`.
- `index.html:192` footer `<h4>` (Contact) → `data-cms="footer_contact_head"`.
- `index.html:204` `<span data-en="Privacy · Terms">` → `data-cms="footer_bottom"`.
- `index.html:203` the rights span: wrap only the phrase — the element `<span data-en="All rights reserved" data-zh="">جميع الحقوق محفوظة</span>` → add `data-cms="footer_rights"` (leave the year `<span data-year>` dynamic, untouched).

- [ ] **Step 4: Verify the build still produces a valid homepage**

Run (needs Supabase env vars; if unavailable locally, skip to Task 9's deploy verification):
`SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/build.mjs`
Expected: `Build done → dist`; `dist/index.html` contains the hero text (default, since DB empty) and the annotations are gone-through cleanly.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(home): annotate homepage body + hero with data-cms keys"
```

---

## Task 7: Annotate shared header/footer in the other 5 pages

**Files:**
- Modify: `projects.html`, `services.html`, `about.html`, `news.html`, `contact.html`

The topbar, `<header class="site-header">`, and `<footer class="site-footer">` blocks are duplicated verbatim across all pages. Apply the SAME header/footer `data-cms` annotations from Task 6 Step 3 to each page's copy, so header/footer edits propagate site-wide.

- [ ] **Step 1: For each of the 5 files, annotate the topbar city, the 6 nav links, the nav CTA, the footer tagline, the two footer `<h4>` headings, the footer bottom span, and the rights span** — identical keys/attributes as Task 6 Step 3.

For each file, first confirm the header/footer markup matches index.html:
Run: `grep -n 'class="nav"' projects.html services.html about.html news.html contact.html`
Then apply the same edits. (If any page's nav differs — e.g. a missing link — annotate only the links that exist; never invent markup.)

- [ ] **Step 2: Sanity-check every intended key is now present across pages**

Run: `grep -rc 'data-cms="nav_home"' index.html projects.html services.html about.html news.html contact.html`
Expected: `1` for each of the 6 files.

- [ ] **Step 3: Commit**

```bash
git add projects.html services.html about.html news.html contact.html
git commit -m "feat(chrome): annotate shared header/footer with data-cms across all pages"
```

---

## Task 8: Admin entities (Homepage / Header-Footer / Theme)

**Files:**
- Modify: `admin/entities.js`
- Modify: `admin/app.js`

Reuses the existing `renderList` + `renderForm` system — adding entities is all that's needed. All three are `single:true` (one seed row, id=1). `title:"id"` shows `1` in the list — acceptable for single-row entities (matches how `contact` shows one editable row).

- [ ] **Step 1: Append the three entities to `ENTITIES` in `admin/entities.js`** (before the closing `];`)

```js
  { key:"home_content", label:"الرئيسية", table:"home_content", order:"id", single:true, title:"id", fields:[
    {n:"hero_image_url",t:"image",l:"صورة خلفية الهيرو"},
    {n:"i18n.hero_title",t:"i18n-text",l:"الهيرو — العنوان"},
    {n:"i18n.hero_lead",t:"i18n-rich",l:"الهيرو — الوصف"},
    {n:"i18n.hero_cta1",t:"i18n-text",l:"الهيرو — زر رئيسي"},
    {n:"i18n.hero_cta2",t:"i18n-text",l:"الهيرو — زر ثانوي"},
    {n:"i18n.search_eyebrow",t:"i18n-text",l:"البحث — العنوان الصغير"},
    {n:"i18n.svc_eyebrow",t:"i18n-text",l:"الخدمات — العنوان الصغير"},
    {n:"i18n.svc_head",t:"i18n-text",l:"الخدمات — العنوان"},
    {n:"i18n.svc1_title",t:"i18n-text",l:"خدمة ١ — العنوان"},{n:"i18n.svc1_desc",t:"i18n-rich",l:"خدمة ١ — الوصف"},
    {n:"i18n.svc2_title",t:"i18n-text",l:"خدمة ٢ — العنوان"},{n:"i18n.svc2_desc",t:"i18n-rich",l:"خدمة ٢ — الوصف"},
    {n:"i18n.svc3_title",t:"i18n-text",l:"خدمة ٣ — العنوان"},{n:"i18n.svc3_desc",t:"i18n-rich",l:"خدمة ٣ — الوصف"},
    {n:"i18n.feat_eyebrow",t:"i18n-text",l:"المميّزة — العنوان الصغير"},
    {n:"i18n.feat_head",t:"i18n-text",l:"المميّزة — العنوان"},
    {n:"i18n.feat_link",t:"i18n-text",l:"المميّزة — رابط (كل المشاريع)"},
    {n:"i18n.partners_eyebrow",t:"i18n-text",l:"الشركاء — العنوان الصغير"},
    {n:"i18n.why_eyebrow",t:"i18n-text",l:"لماذا — العنوان الصغير"},
    {n:"i18n.why_head",t:"i18n-text",l:"لماذا — العنوان"},
    {n:"i18n.why_lead",t:"i18n-rich",l:"لماذا — الوصف"},
    {n:"i18n.why_cta",t:"i18n-text",l:"لماذا — زر"},
    {n:"i18n.why1_title",t:"i18n-text",l:"سبب ١ — العنوان"},{n:"i18n.why1_desc",t:"i18n-rich",l:"سبب ١ — الوصف"},
    {n:"i18n.why2_title",t:"i18n-text",l:"سبب ٢ — العنوان"},{n:"i18n.why2_desc",t:"i18n-rich",l:"سبب ٢ — الوصف"},
    {n:"i18n.why3_title",t:"i18n-text",l:"سبب ٣ — العنوان"},{n:"i18n.why3_desc",t:"i18n-rich",l:"سبب ٣ — الوصف"},
    {n:"i18n.cta_head",t:"i18n-text",l:"شريط CTA — العنوان"},
    {n:"i18n.cta_lead",t:"i18n-rich",l:"شريط CTA — الوصف"},
    {n:"i18n.cta_primary",t:"i18n-text",l:"شريط CTA — زر رئيسي"},
    {n:"i18n.cta_wa",t:"i18n-text",l:"شريط CTA — زر واتساب"} ]},
  { key:"site_chrome", label:"الهيدر والفوتر", table:"site_chrome", order:"id", single:true, title:"id", fields:[
    {n:"i18n.nav_home",t:"i18n-text",l:"القائمة — الرئيسية"},
    {n:"i18n.nav_projects",t:"i18n-text",l:"القائمة — المشاريع"},
    {n:"i18n.nav_services",t:"i18n-text",l:"القائمة — الخدمات"},
    {n:"i18n.nav_about",t:"i18n-text",l:"القائمة — من نحن"},
    {n:"i18n.nav_news",t:"i18n-text",l:"القائمة — الأخبار"},
    {n:"i18n.nav_contact",t:"i18n-text",l:"القائمة — تواصل"},
    {n:"i18n.nav_cta",t:"i18n-text",l:"القائمة — زر الاستشارة"},
    {n:"i18n.topbar_city",t:"i18n-text",l:"الشريط العلوي — المدينة"},
    {n:"i18n.footer_tag",t:"i18n-rich",l:"الفوتر — الوصف"},
    {n:"i18n.footer_explore_head",t:"i18n-text",l:"الفوتر — عنوان تصفّح"},
    {n:"i18n.footer_contact_head",t:"i18n-text",l:"الفوتر — عنوان تواصل"},
    {n:"i18n.footer_bottom",t:"i18n-text",l:"الفوتر — الشريط السفلي"},
    {n:"i18n.footer_rights",t:"i18n-text",l:"الفوتر — الحقوق"} ]},
  { key:"site_theme", label:"المظهر", table:"site_theme", order:"id", single:true, title:"id", fields:[
    {n:"font_preset",t:"select",l:"الخط",options:["classic","modern","elegant","simple"],
      hint:"classic=كلاسيكي · modern=عصري · elegant=أنيق · simple=بسيط"},
    {n:"accent_preset",t:"select",l:"لون الهوية",options:["gold","green","navy","charcoal","burgundy"],
      hint:"gold=ذهبي · green=أخضر · navy=كحلي · charcoal=فحمي · burgundy=نبيذي"} ]},
```

- [ ] **Step 2: Add icons in `admin/app.js`**

In `admin/app.js:25`, extend the `iconFor` map:

```js
  const iconFor = { projects: "projects", news: "news", partners: "partners", stats: "stats", pages: "pages", contact: "contact", social_links: "social", home_content: "home", site_chrome: "pages", site_theme: "pages" };
```

(`home` icon already exists in `admin/shell.js:5`.)

- [ ] **Step 3: Manual admin smoke test**

Serve the admin locally (or on the deployed site's `/admin/`), log in, and confirm three new nav items appear: «الرئيسية», «الهيدر والفوتر», «المظهر». Open each → the form renders → editing a field and pressing «حفظ» succeeds (writes to the seed row). Verify no console errors.

Expected: each form saves without error; re-opening shows the saved value.

- [ ] **Step 4: Commit**

```bash
git add admin/entities.js admin/app.js
git commit -m "feat(admin): homepage / header-footer / theme entities"
```

---

## Task 9: End-to-end verification + publish

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `node --test scripts/lib/`
Expected: all pass.

- [ ] **Step 2: Live edit round-trip**

In the admin: set «الرئيسية» → hero title (ar) to a distinct test value, upload a hero image, and set «المظهر» → font `elegant`, accent `green`. Save each. Press «نشر الموقع».

- [ ] **Step 3: Confirm on the built site (after ~1 min deploy)**

- Homepage hero shows the test value and new image.
- Font/accent changed site-wide.
- Header/footer edits (set one nav label) appear on `projects.html` too.
- Revert the test hero title to blank → republish → default Arabic text returns (fallback works).

- [ ] **Step 4: Known limitations to note (not bugs)**

The inline logo SVG dot (`fill="#A38A58"`) and the `--summit-tile` background SVG use a hardcoded gold and do NOT follow the accent preset. Out of scope; flag to the user if the accent color needs to reach them later.

- [ ] **Step 5: Final commit (if any verification tweaks were needed)**

```bash
git add -A
git commit -m "chore(home): homepage CMS verified end-to-end"
```

---

## Self-Review notes

- **Spec coverage:** AC-1→Task 1; AC-2→Tasks 3,5,6,8; AC-3→Tasks 5,7,8; AC-4→Tasks 3,5,6,8; AC-5→Tasks 2,5,8; AC-6→Tasks 3,5 (empty-value fallback tests) + Task 9 Step 3; AC-7→defaults kept in source (Task 6/7 keep `data-en`), hreflang untouched in `renderPages`.
- **Variable names** verified against `assets/css/styles.css:15-19,32-35` — theme overrides the real tokens; no CSS refactor needed.
- **Preset ids** in `theme.mjs` (Task 2) match `entities.js` select options (Task 8): fonts `classic/modern/elegant/simple`, accents `gold/green/navy/charcoal/burgundy`.
- **Function signatures** consistent: `applyContent(root, {text, heroImage}, locale)` defined in Task 3, called with that exact shape in Task 5.
