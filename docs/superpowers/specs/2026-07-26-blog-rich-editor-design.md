# Blog Rich Editor — Design

**Date:** 2026-07-26
**Status:** Approved (design), ready for implementation plan
**Author:** Abdullah Sumayli (with Claude Code)

## Problem

The admin blog/news article editor (`admin/`) is a plain `<textarea>` per language
(ع / EN / 中文). Authors cannot insert images inside the article body, cannot build
tables, and pasted URLs stay as inert plain text. Content teams need a richer editor.

## Goals

1. **Inline images** inside the article body — upload from device (reuse existing
   `uploadImage()` → Supabase `media` bucket) **and** paste an external image URL.
2. **Tables** ("Excel-like") — build manually (add/remove rows & columns, editable
   cells) **and** paste a table copied from Excel / Google Sheets (auto-converts to
   an HTML `<table>`).
3. **Clickable links** — a link button (wrap selection) **and** auto-linking: a bare
   `https://…` typed or pasted becomes a clickable `<a>`. Links open in a new tab
   safely on the public page.

## Non-Goals (YAGNI)

- No `<iframe>` embeds (YouTube/Maps). Explicitly disallowed for security.
- No spreadsheet formulas / cell math — tables are static content only.
- No migration of existing plain-text articles (handled transparently, see below).
- No third-party WYSIWYG library, no bundler. Vanilla, matching the admin's style.

## Chosen Approach

**Custom lightweight `contenteditable` editor** (no external dependency). Rejected
alternatives: Quill (weak table support, no Excel-paste, heavy for a vanilla admin),
TipTap/ProseMirror (requires a bundler the admin does not have).

## Architecture & Data Flow

```
Admin editor (contenteditable HTML)
        │  stores HTML string
        ▼
news.i18n.body[locale]   (jsonb — UNCHANGED schema; already holds a string per locale)
        │
        ├── build:  scripts/lib/renderArticle.mjs  formatBody() → sanitize() → static news/<slug>.html
        └── preview: assets/js/main.js             formatBody() → sanitize() → article.html?preview=1
```

Storage is unchanged: `i18n.body[locale]` already holds a per-locale string. It now
holds an **HTML** string instead of plain text. `formatBody()` already passes HTML
through untouched when it starts with a block tag — so no storage/schema change.

### Components

**1. `admin/richeditor.js` (new)** — exports a factory that builds one editor
instance: a toolbar + a `contenteditable` div. API mirrors what `localeTabs` needs:
`{ el, getHTML(), setHTML(html) }`. Responsibilities:
- Toolbar: bold, italic, H2/H3, bullet list, numbered list, link, image, table.
- Direction: `dir="rtl"` for `ar`, `dir="ltr"` for `en`/`zh`.
- Image button → small menu: **upload** (file input → `uploadImage("news", file)` →
  insert `<img class="adetail__img" src alt>`) or **paste URL** (prompt → insert img).
- Table button → insert a starter 2×2 `<table>` with row/column controls; cells are
  `contenteditable`. Row/col controls are editor-only chrome, never serialized.
- Paste handler:
  - Clipboard contains an HTML table or TSV (tab-separated rows) → build `<table>`.
  - Clipboard is a bare URL → insert an `<a>`.
  - Otherwise → insert as sanitized plain text (strip pasted markup to avoid Word/
    Google-Docs style soup).
- Auto-link: on blur / on space after a bare URL, wrap it in `<a>`.
- `getHTML()` returns the serialized body HTML with editor-only chrome removed.

**2. `admin/fields.js` — `localeTabs()` change** — when `field.t === "i18n-rich"`,
build a `richeditor` instance instead of a `<textarea>`. On change, call
`onLocale(cur, editor.getHTML())`. On tab switch / load, `editor.setHTML(value[cur])`.
Loading a legacy plain-text body: if the stored value has no block HTML, convert
newlines to `<p>`/`<br>` for editing (same rule as `formatBody`), so old articles
edit cleanly. Everything else in `fields.js` (draft/preview/publish) is unchanged.

**3. Sanitizer (shared logic, two runtimes)** — an allowlist sanitizer applied on
**both** render paths so preview and published output are identical and safe:
- **Allowed tags:** `p, h2, h3, h4, ul, ol, li, a, img, table, thead, tbody, tr, td,
  th, strong, em, b, i, br, figure, figcaption, blockquote`.
- **Allowed attributes:** `a[href]` (http/https/mailto only), `img[src,alt]`
  (http/https/data-image only), `td/th[colspan,rowspan]`, `class` (whitelisted names).
- **Stripped:** `script, style, iframe, on*` handlers, `javascript:` URLs, and any tag
  not on the allowlist (unwrap, keep text).
- `a` tags get `target="_blank" rel="noopener nofollow"` added at render.
- Build side: `scripts/lib/sanitizeHtml.mjs` (pure, Node, regex/parser-based — no DOM).
- Client side: `assets/js/main.js` uses a DOM-based sanitizer (browser has DOM).
- Both must produce equivalent output; covered by tests on the `.mjs` version.

**4. `formatBody()` (both copies)** — after the existing "already HTML → passthrough"
branch, run the result through the sanitizer before returning. Plain-text branch is
unchanged (already escapes). Keep `renderArticle.mjs` and `main.js` copies in sync.

**5. `excerptFrom()` (meta description)** — must strip HTML tags before deriving the
description, so `<p>`/`<img>` markup never leaks into `<meta name="description">`.

**6. CSS** — add body-content styles in the public article stylesheet and the admin
editor stylesheet:
- `.adetail__body img { max-width:100%; height:auto; border-radius; }`
- `.adetail__body table { border-collapse; width:100%; }` + `td,th` borders, RTL.
- `.adetail__body a { color: brand; underline }`.
- Admin: toolbar styling, `contenteditable` frame matching the current `.richbody`.

## Error Handling

- Image upload failure → inline status message in the editor (reuse the existing
  `uploadstatus` pattern), no `<img>` inserted.
- Paste of unknown/garbage HTML → sanitized to plain text, never breaks the editor.
- Empty body → `formatBody` returns "" (existing behavior); article falls back to
  excerpt (existing behavior in `renderArticleHtml`).
- Legacy plain-text articles → still render via the plain-text branch of `formatBody`.

## Testing

- `scripts/lib/sanitizeHtml.test.mjs` (new): strips `<script>`, `on*`, `iframe`,
  `javascript:` URLs; keeps allowed tags/attrs; adds `target/rel` to links.
- Extend `scripts/lib/renderArticle.test.mjs`: HTML body passes through + sanitized;
  legacy plain-text body still wraps in `<p>`; a bare URL in body renders clickable.
- Manual QA: create an article with an inline uploaded image, a pasted-URL image, a
  hand-built table, an Excel-pasted table, an inline link, and a bare-URL auto-link;
  verify preview (`article.html?preview=1`) matches the published static page in
  ar / en / zh, including RTL.

## Files Touched

- `admin/richeditor.js` — **new** editor component.
- `admin/fields.js` — swap textarea → richeditor for `i18n-rich`; legacy-load helper.
- `admin/admin.css` — toolbar + editable-area styles.
- `scripts/lib/sanitizeHtml.mjs` — **new** Node sanitizer.
- `scripts/lib/renderArticle.mjs` — sanitize in `formatBody`.
- `scripts/lib/dataJs.mjs` — `excerptFrom` strips HTML.
- `scripts/lib/sanitizeHtml.test.mjs` — **new** tests.
- `scripts/lib/renderArticle.test.mjs` — extended tests.
- `assets/js/main.js` — mirror `formatBody` sanitize + client sanitizer for preview.
- Public article CSS (body img/table/link styles).

## Rollback

Storage is unchanged; a body saved as HTML remains valid. Reverting the code reverts
`formatBody` to passthrough (HTML would render unsanitized as before), so a revert is
safe though it drops the sanitizer — acceptable since content is admin-authored.
