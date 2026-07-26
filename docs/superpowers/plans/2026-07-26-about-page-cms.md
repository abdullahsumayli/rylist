# About Page CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every text zone of the "من نحن" (About) page editable from the admin dashboard, exactly the way the homepage already is.

**Architecture:** A new single-row `about_content` table (mirroring `home_content`) holds `{ about_*: {ar,en,zh} }` text in an `i18n jsonb` column. `about.html` elements get `data-cms="about_*"` attributes; the build step (`renderPages` → `applyContent`) overlays DB values onto them at build time, keeping the hardcoded text as SEO/fallback. A new admin entity exposes the fields through the existing single-row editor.

**Tech Stack:** Supabase (Postgres + RLS), Node ESM build scripts, `node-html-parser`, `node:test`, vanilla JS admin.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/0014_about_content.sql` | New table + RLS + seed row + remove dead `about` row from `pages` |
| `scripts/lib/renderPages.mjs` | Merge `c.about?.i18n` into the build text map |
| `scripts/lib/renderPages.test.mjs` | Test that About overlay works + fallback preserved |
| `scripts/lib/fetchContent.mjs` | Fetch the `about_content` single row |
| `about.html` | ~36 `data-cms="about_*"` attributes |
| `admin/entities.js` | New `about_content` entity (single-row) |
| `admin/app.js` | `iconFor.about_content = "pages"` |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0014_about_content.sql`

- [ ] **Step 1: Verify the real constraint name on `pages.key`**

Use the Supabase MCP (`mcp__claude_ai_Supabase`, project ref `ghtcwsbtyvczlznviojj`). Run:

```sql
select conname from pg_constraint
where conrelid = 'public.pages'::regclass and contype = 'c';
```

Expected: a single check-constraint name (likely `pages_key_check`). Use the actual returned name in Step 2.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/0014_about_content.sql` (replace `pages_key_check` with the name from Step 1 if different):

```sql
-- 0014_about_content.sql — نصوص صفحة "من نحن" (صف واحد id=1)، بنفس نمط home_content

create table if not exists public.about_content (
  id         int primary key default 1 check (id = 1),
  i18n       jsonb not null default '{}'::jsonb,   -- { about_eyebrow:{ar,en,zh}, ... }
  updated_at timestamptz not null default now()
);
create trigger trg_about_content_updated before update on public.about_content
  for each row execute function public.set_updated_at();

insert into public.about_content (id) values (1) on conflict (id) do nothing;

alter table public.about_content enable row level security;
create policy "about_content read"  on public.about_content for select using (true);
create policy "about_content write" on public.about_content for all
  using (public.is_admin()) with check (public.is_admin());

-- إزالة إدخال "about" الميّت من قسم "الصفحات" (services يبقى)
delete from public.pages where key = 'about';
alter table public.pages drop constraint pages_key_check;
alter table public.pages add  constraint pages_key_check check (key in ('services'));
```

- [ ] **Step 3: Apply the migration to the remote project**

Use `mcp__claude_ai_Supabase__apply_migration` with name `0014_about_content` and the SQL above (project ref `ghtcwsbtyvczlznviojj`).

- [ ] **Step 4: Verify**

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
select id, i18n from public.about_content;
select key from public.pages order by key;
```

Expected: `about_content` has one row `id=1, i18n={}`. `pages` lists only `services` (no `about`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_about_content.sql
git commit -m "feat(about): add about_content table + drop dead pages.about row"
```

---

### Task 2: Wire the build to overlay About content (TDD)

**Files:**
- Modify: `scripts/lib/renderPages.mjs:41-45`
- Test: `scripts/lib/renderPages.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/renderPages.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/renderPages.test.mjs`
Expected: the "overlays about_content" test FAILS (default `قديم` still present, `من نحن الجديد` missing); the "keeps default" test PASSES. Other existing tests still pass.

- [ ] **Step 3: Implement the merge**

In `scripts/lib/renderPages.mjs`, change the `content` object inside `renderPages` (currently lines 43-46) to include About text:

```js
export function renderPages(out, c, siteUrl){
  const locales = c.locales; // مفعّلة فقط
  const content = {
    text: { ...(c.home?.i18n || {}), ...(c.chrome?.i18n || {}), ...(c.about?.i18n || {}) },
    heroImage: c.home?.hero_image_url || "",
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lib/renderPages.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/renderPages.mjs scripts/lib/renderPages.test.mjs
git commit -m "feat(about): overlay about_content i18n in renderPages"
```

---

### Task 3: Fetch about_content in the build data layer

**Files:**
- Modify: `scripts/lib/fetchContent.mjs:11-17`

- [ ] **Step 1: Add the fetch + return key**

In `scripts/lib/fetchContent.mjs`, update the single-row block and the return object:

```js
  const single = async (t) => (await sb.from(t).select("*").eq("id", 1).maybeSingle()).data || {};
  const [contact, home, chrome, theme, about] = await Promise.all([
    single("contact"), single("home_content"), single("site_chrome"), single("site_theme"), single("about_content"),
  ]);
  const pages = Object.fromEntries(((await sb.from("pages").select("*")).data||[]).map(p=>[p.key,p.i18n]));
  return { locales: locales.filter(l=>l.enabled), taxonomies, projects, news, partners, stats,
           social: social.filter(s=>s.enabled), contact, pages, home, chrome, theme, about };
```

- [ ] **Step 2: Verify it parses**

Run: `node -e "import('./scripts/lib/fetchContent.mjs').then(()=>console.log('ok'))"`
Expected: prints `ok` (module imports without syntax error; it will not connect without env vars, which is fine — we only import).

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/fetchContent.mjs
git commit -m "feat(about): fetch about_content row in build content layer"
```

---

### Task 4: Tag about.html elements with data-cms

**Files:**
- Modify: `about.html`

- [ ] **Step 1: Add the banner + story attributes**

Apply these exact element replacements in `about.html`:

Banner eyebrow (currently at ~line 56):
```html
<span class="eyebrow" data-cms="about_eyebrow" data-en="About us" data-zh="关于我们">من نحن</span>
```
Banner title:
```html
<h1 class="display" data-cms="about_title" data-en="Helping you choose with confidence." data-zh="助您自信选择。">نساعدك تختار بثقة.</h1>
```
Banner lead (keep the existing `data-en`/`data-zh` values, add `data-cms="about_lead"` to the opening `<p class="lead" ...>` tag).

Story eyebrow:
```html
<span class="eyebrow" data-cms="about_story_eyebrow" data-en="Our story" data-zh="我们的故事">قصّتنا</span>
```
Story head:
```html
<h2 data-cms="about_story_head" data-en="A clearer way to choose your property." data-zh="更清晰地选择您的房产。">طريقة أوضح تختار فيها عقارك.</h2>
```
Story paragraph 1: add `data-cms="about_story_p1"` to its `<p ...>` opening tag.
Story paragraph 2: add `data-cms="about_story_p2"` to its `<p ...>` opening tag.

- [ ] **Step 2: Add mission / vision attributes**

Mission eyebrow:
```html
<div class="eyebrow" data-cms="about_mission_eyebrow" data-en="Mission" data-zh="使命">المهمّة</div>
```
Mission text: add `data-cms="about_mission_text"` to the `<p class="lead" ...>` opening tag under the Mission eyebrow.
Vision eyebrow:
```html
<div class="eyebrow" data-cms="about_vision_eyebrow" data-en="Vision" data-zh="愿景">الرؤية</div>
```
Vision text: add `data-cms="about_vision_text"` to the `<p class="lead" ...>` opening tag under the Vision eyebrow.

- [ ] **Step 3: Add steps section attributes**

Steps eyebrow:
```html
<span class="eyebrow" data-cms="about_steps_eyebrow" data-en="How you choose with us" data-zh="如何与我们一起选择">كيف تختار معنا</span>
```
Steps head:
```html
<h2 data-cms="about_steps_head" data-en="Four steps to choose with confidence." data-zh="四步，自信选择。">أربع خطوات حتى تختار بثقة.</h2>
```
For each of the 4 `.step` blocks, add `data-cms` to the `<h3>` and `<p>`:
- Step 1: `<h3 data-cms="about_step1_title" ...>`, `<p data-cms="about_step1_desc" ...>`
- Step 2: `<h3 data-cms="about_step2_title" ...>`, `<p data-cms="about_step2_desc" ...>`
- Step 3: `<h3 data-cms="about_step3_title" ...>`, `<p data-cms="about_step3_desc" ...>`
- Step 4: `<h3 data-cms="about_step4_title" ...>`, `<p data-cms="about_step4_desc" ...>`

(Preserve each element's existing `data-en`/`data-zh` and inner text; only insert the `data-cms` attribute.)

- [ ] **Step 4: Add values section attributes**

Values eyebrow:
```html
<span class="eyebrow" data-cms="about_values_eyebrow" data-en="Core values" data-zh="核心价值观">قيمنا</span>
```
Values head:
```html
<h2 data-cms="about_values_head" data-en="What we hold to." data-zh="我们所坚守的。">ما نلتزم به.</h2>
```
For each of the 5 `.value` blocks, add `data-cms` to the `<h3>` and `<p>`:
- Value 1: `about_val1_title` / `about_val1_desc`
- Value 2: `about_val2_title` / `about_val2_desc`
- Value 3: `about_val3_title` / `about_val3_desc`
- Value 4: `about_val4_title` / `about_val4_desc`
- Value 5: `about_val5_title` / `about_val5_desc`

- [ ] **Step 5: Add quote + CTA attributes**

Quote:
```html
<p class="q" data-cms="about_quote" data-en="“The right purchase decision starts with clear information.”" data-zh="“正确的购置决定，始于清晰的信息。”">«قرار الشراء الصحيح يبدأ بمعلومات واضحة.»</p>
```
CTA head:
```html
<h2 class="h1" data-cms="about_cta_head" data-en="Ready to find your property?" data-zh="准备好寻找您的房产了吗？">جاهز تلاقي عقارك؟</h2>
```
CTA button:
```html
<a class="btn btn--primary" href="contact.html" data-cms="about_cta_btn" data-en="Contact us" data-zh="联系我们">تواصل معنا</a>
```

- [ ] **Step 6: Verify no accidental breakage**

Run: `node -e "const {parse}=require('node-html-parser');const fs=require('fs');const r=parse(fs.readFileSync('about.html','utf8'));const n=r.querySelectorAll('[data-cms^=about_]').length;console.log('about_ cms tags:',n);if(n!==36)process.exit(1)"`
Expected: prints `about_ cms tags: 36`. (If `node-html-parser` isn't resolvable via `require`, run the same check with an ESM `import` one-liner.)

- [ ] **Step 7: Commit**

```bash
git add about.html
git commit -m "feat(about): tag about.html text zones with data-cms attributes"
```

---

### Task 5: Add the admin entity

**Files:**
- Modify: `admin/entities.js` (append a new entity to the `ENTITIES` array, before the closing `];`)
- Modify: `admin/app.js:26`

- [ ] **Step 1: Add the `about_content` entity**

Insert this object into the `ENTITIES` array in `admin/entities.js` (e.g. right after the `home_content` entity):

```js
  { key:"about_content", label:"صفحة من نحن", table:"about_content", order:"id", single:true, title:"id", fields:[
    {n:"i18n.about_eyebrow",     t:"i18n-text", l:"البانر — العنوان الصغير"},
    {n:"i18n.about_title",       t:"i18n-text", l:"البانر — العنوان"},
    {n:"i18n.about_lead",        t:"i18n-rich", l:"البانر — الوصف"},
    {n:"i18n.about_story_eyebrow", t:"i18n-text", l:"القصة — العنوان الصغير"},
    {n:"i18n.about_story_head",  t:"i18n-text", l:"القصة — العنوان"},
    {n:"i18n.about_story_p1",    t:"i18n-rich", l:"القصة — فقرة ١"},
    {n:"i18n.about_story_p2",    t:"i18n-rich", l:"القصة — فقرة ٢"},
    {n:"i18n.about_mission_eyebrow", t:"i18n-text", l:"المهمّة — العنوان الصغير"},
    {n:"i18n.about_mission_text",t:"i18n-rich", l:"المهمّة — النص"},
    {n:"i18n.about_vision_eyebrow", t:"i18n-text", l:"الرؤية — العنوان الصغير"},
    {n:"i18n.about_vision_text", t:"i18n-rich", l:"الرؤية — النص"},
    {n:"i18n.about_steps_eyebrow", t:"i18n-text", l:"الخطوات — العنوان الصغير"},
    {n:"i18n.about_steps_head",  t:"i18n-text", l:"الخطوات — العنوان"},
    {n:"i18n.about_step1_title", t:"i18n-text", l:"خطوة ١ — العنوان"},
    {n:"i18n.about_step1_desc",  t:"i18n-rich", l:"خطوة ١ — الوصف"},
    {n:"i18n.about_step2_title", t:"i18n-text", l:"خطوة ٢ — العنوان"},
    {n:"i18n.about_step2_desc",  t:"i18n-rich", l:"خطوة ٢ — الوصف"},
    {n:"i18n.about_step3_title", t:"i18n-text", l:"خطوة ٣ — العنوان"},
    {n:"i18n.about_step3_desc",  t:"i18n-rich", l:"خطوة ٣ — الوصف"},
    {n:"i18n.about_step4_title", t:"i18n-text", l:"خطوة ٤ — العنوان"},
    {n:"i18n.about_step4_desc",  t:"i18n-rich", l:"خطوة ٤ — الوصف"},
    {n:"i18n.about_values_eyebrow", t:"i18n-text", l:"القيم — العنوان الصغير"},
    {n:"i18n.about_values_head", t:"i18n-text", l:"القيم — العنوان"},
    {n:"i18n.about_val1_title",  t:"i18n-text", l:"قيمة ١ — العنوان"},
    {n:"i18n.about_val1_desc",   t:"i18n-rich", l:"قيمة ١ — الوصف"},
    {n:"i18n.about_val2_title",  t:"i18n-text", l:"قيمة ٢ — العنوان"},
    {n:"i18n.about_val2_desc",   t:"i18n-rich", l:"قيمة ٢ — الوصف"},
    {n:"i18n.about_val3_title",  t:"i18n-text", l:"قيمة ٣ — العنوان"},
    {n:"i18n.about_val3_desc",   t:"i18n-rich", l:"قيمة ٣ — الوصف"},
    {n:"i18n.about_val4_title",  t:"i18n-text", l:"قيمة ٤ — العنوان"},
    {n:"i18n.about_val4_desc",   t:"i18n-rich", l:"قيمة ٤ — الوصف"},
    {n:"i18n.about_val5_title",  t:"i18n-text", l:"قيمة ٥ — العنوان"},
    {n:"i18n.about_val5_desc",   t:"i18n-rich", l:"قيمة ٥ — الوصف"},
    {n:"i18n.about_quote",       t:"i18n-rich", l:"الاقتباس"},
    {n:"i18n.about_cta_head",    t:"i18n-text", l:"شريط CTA — العنوان"},
    {n:"i18n.about_cta_btn",     t:"i18n-text", l:"شريط CTA — الزر"},
  ]},
```

- [ ] **Step 2: Add the nav icon mapping**

In `admin/app.js`, extend the `iconFor` object (line 26) with `about_content: "pages"`:

```js
  const iconFor = { projects: "projects", news: "news", partners: "partners", stats: "stats", pages: "pages", contact: "contact", social_links: "social", home_content: "home", site_chrome: "pages", site_theme: "pages", about_content: "pages" };
```

- [ ] **Step 3: Verify the module parses**

Run: `node -e "import('./admin/entities.js').then(m=>{const e=m.ENTITIES.find(x=>x.key==='about_content');console.log('fields:',e.fields.length);if(e.fields.length!==36)process.exit(1)})"`
Expected: prints `fields: 36`.

- [ ] **Step 4: Commit**

```bash
git add admin/entities.js admin/app.js
git commit -m "feat(about): add 'صفحة من نحن' editor to admin"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `node --test scripts/`
Expected: all tests PASS (renderPages, renderProject, renderArticle, content-data).

- [ ] **Step 2: Manual smoke check of the admin editor**

Confirm in the running admin dashboard that a new nav item **"صفحة من نحن"** appears and opens the single-row editor with the 36 fields grouped by zone, and that **"الصفحات"** no longer lists an `about` entry. (Editing + saving writes to `about_content`; the live change appears after a publish/rebuild.)

- [ ] **Step 3: Confirm nothing else regressed**

Run: `git status` and review the diff is limited to the 7 files in the File Structure table plus the two spec/plan docs.

---

## Self-Review

- **Spec coverage:** DB table (Task 1) ✓, `data-cms` tags (Task 4) ✓, admin entity (Task 5) ✓, build wiring — fetchContent (Task 3) + renderPages (Task 2) ✓, test (Task 2) ✓, remove dead `pages.about` (Task 1) ✓. All spec sections covered.
- **Placeholder scan:** no TBD/TODO; the only runtime-verified value is the `pages` check-constraint name, which has an explicit lookup step (Task 1 Step 1).
- **Type/name consistency:** the 36 `about_*` keys are identical across about.html (Task 4), the entity `i18n.about_*` fields (Task 5), and the test key `about_title` (Task 2). Table name `about_content` consistent across migration, fetchContent, and entity.
