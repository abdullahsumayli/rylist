# Blog: simplified editor + draft/preview/publish

**Date:** 2026-07-25
**Status:** Approved (design), implementing

## Problem

Two issues with the blog (المدونة / `news`):

1. The admin news form exposes generic entity fields (slug, status, published_at, image, title, body). The owner wants only **العنوان (title)**, **الصورة (image)**, **المقال (body)** — nothing else. Leaving the required `slug` blank currently produces a raw Postgres error (`null value in column "slug" ... violates not-null constraint`).
2. There is no way to review a post as a full article before publishing. Blog cards even link to `news/<slug>.html`, which **does not exist** (404) — the full article body never reaches the public site either ([`flatNews`](../../../scripts/lib/dataJs.mjs) drops it).

## Goal

- News editor shows exactly 3 fields: title, image, body.
- `slug` / `status` / `published_at` are managed automatically, never shown.
- A **معاينة (Preview)** action opens the post as a full reader page (new tab), exactly as visitors will see it — even before saving.
- A **draft → publish** workflow: drafts never appear to visitors; publishing marks the post live.
- Blog cards open a **real full-article page** (`article.html`), fixing the current 404.

## Design

### 1. Simplified `news` entity — `admin/entities.js`
Reduce visible fields to title, image, body, and add workflow config:
```js
{ key:"news", label:"المدونة", table:"news", order:"published_at",
  title:"i18n.title", workflow:"draft", slugFrom:"i18n.title",
  fields:[
    {n:"i18n.title", t:"i18n-text", l:"العنوان"},
    {n:"image_url",  t:"image",     l:"الصورة"},
    {n:"i18n.body",  t:"i18n-rich", l:"المقال"},
  ]}
```
`slug`, `status`, `published_at` are no longer form fields but remain DB columns, set by the save logic.

### 2. Draft workflow in `renderForm` — `admin/fields.js`
When `ent.workflow === "draft"`, replace the single «حفظ» with three buttons:

- **[حفظ كمسودة]** — `status="draft"`; ensure slug; upsert. Never visible to visitors.
- **[معاينة]** — write the current draft to `localStorage["rylist:news-preview"]`, open `article.html?preview=1` in a new tab. No DB write required.
- **[نشر]** — `status="published"`; set `published_at` to now if empty; ensure slug; upsert; then invoke the existing deploy (`sb.functions.invoke("publish", …)`) so it goes live. On deploy-invoke failure the post is still saved published, with a hint to use the نشر page.

**Slug auto-generation** (`makeSlug`, shared, pure): slugify a latin title; if the result is empty (e.g. Arabic-only title) fall back to `p-<base36 timestamp>`. Only generated when `slug` is empty (new post); editing keeps the existing slug. Lives in a pure module so it is unit-testable.

Required-field enforcement (added earlier for the raw-error bug) stays and covers other entities.

### 3. Published articles already have full pages — reuse them
**Correction after code review:** the site *already* builds a real per-article page for every published post — `dist/news/<slug>.html` (+ `/en`, `/zh`) via `templates/article.html` + `scripts/lib/renderArticle.mjs`, with hero, category, date, title, lead, formatted body, and SEO canonical/hreflang. Blog cards already link there correctly. So there is **nothing to build for the published reader view, and `articleCard`'s `news/<slug>.html` link stays as-is.** `flatNews` is left unchanged (the static page reads raw i18n via `fetchContent`, not the flat `NEWS`).

### 4. Preview page — `article.html` (new, preview-only, `noindex`)
Drafts cannot be statically built, so the preview is the only genuinely new page. A minimal root page mirroring the published article's `pdetail`/`adetail` markup and styles (not the full site chrome — the real article pages have none either), populated by `renderArticlePreview()` in `main.js`:
- Reads the draft from `localStorage["rylist:news-preview"]` (written by the admin «معاينة» button).
- Renders title, date, image, and body via a browser port of `renderArticle.mjs`'s `formatBody` (identical paragraph rules), plus a sticky "معاينة — مسودة" banner.
- No `?slug=` published mode — published posts use their static pages.
- Deployed by adding `article.html` to the static-copy list in `scripts/build.mjs` (kept out of `renderPages` PAGES so it gets no locale variants or canonical tags).

## Data flow / safety
- Draft safety is **already guaranteed** by `scripts/lib/fetchContent.mjs`, which fetches `news` with `.eq("status","published")`. Drafts never reach `data.js` *or* the static `news/<slug>.html` pages.
- Preview never touches the DB or the live site; it is a browser-local handoff.

## Out of scope (YAGNI)
- Category/excerpt editing (excerpt auto-derives; category dropped).
- Per-article static HTML files (single dynamic `article.html` instead).
- Scheduled publishing, revisions/history.

## Testing
- Unit tests (`node --test`, existing harness):
  - `makeSlug`: latin title → kebab slug; Arabic-only → `p-…` fallback; empty → fallback.
  - `flatNews`: includes `bodyAr`/`bodyEn`; excerpt still derives from body.
- Manual: create post with only title/image/body → preview opens full page → save draft (absent from live) → publish (appears) → card opens `article.html`.
