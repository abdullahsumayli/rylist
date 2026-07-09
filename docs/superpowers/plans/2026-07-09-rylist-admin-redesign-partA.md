# RYLIST Admin Redesign — Part A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the RYLIST admin panel with the approved "silent-luxury" identity — a dark sidebar shell, a rich Properties section (stat cards + filters + image-card grid), redesigned forms — and add an end-to-end `reserved` property status, without breaking the static site, the publish flow, or RLS.

**Architecture:** Pure-ESM browser admin under `/admin/` (no build step). Split the monolithic `ui.js` into focused modules: `shell.js` (sidebar + router), `fields.js` (shared form), `projects.js` (rich properties view), `list.js` (generic table). `supabase-js` is vendored locally to remove the `esm.sh` runtime dependency. Styling and exact view markup are ported from the approved mockup. A DB migration widens `projects.status` to include `reserved`, and the public site (`main.js`, project template) learns to render it.

**Tech Stack:** Static HTML/CSS/JS (ESM), `@supabase/supabase-js` (vendored), Supabase Postgres + Auth + Storage, Node build (`scripts/build.mjs`), Supabase MCP for the migration.

**Design references (source of truth for view/CSS):**
- Approved mockup: [docs/superpowers/specs/2026-07-09-rylist-admin-mockup.html](../specs/2026-07-09-rylist-admin-mockup.html)
- Spec: [docs/superpowers/specs/2026-07-09-rylist-admin-redesign-partA-design.md](../specs/2026-07-09-rylist-admin-redesign-partA-design.md)

**Testing note:** This project has no JS test harness (only `npm run build`). Verification is therefore: (a) SQL assertions for the migration, (b) `npm run build` success + `dist/` inspection, (c) a browser smoke-test checklist at https://rylist.sa/admin/ after publish. Steps state the exact check and expected result. Do not invent a test framework.

**Branch:** Create `feat/admin-redesign-part-a` before Task 1. Commit after each task.

---

### Task 1: DB migration — `reserved` status

**Files:**
- Create: `supabase/migrations/0006_reserved_status.sql` (record of the change; applied via MCP)

- [ ] **Step 1: Find the current check-constraint name**

Run via `mcp__claude_ai_Supabase__execute_sql` (project_id `ghtcwsbtyvczlznviojj`):
```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.projects'::regclass and contype = 'c';
```
Expected: a row whose def is `CHECK (status = ANY (ARRAY['available','sold']))`. Note its `conname` (e.g. `projects_status_check`).

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/0006_reserved_status.sql` (use the real constraint name from Step 1):
```sql
-- 0006_reserved_status.sql — allow 'reserved' alongside 'available' and 'sold'
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('available','reserved','sold'));
```

- [ ] **Step 3: Apply the migration**

Call `mcp__claude_ai_Supabase__apply_migration` with `name = "0006_reserved_status"` and `query` = the file body above.

- [ ] **Step 4: Verify the constraint accepts `reserved` and still rejects junk**

Run via `execute_sql`:
```sql
-- should succeed (0 rows changed is fine; we only test the constraint)
update public.projects set status = status where false;
select pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid='public.projects'::regclass and conname='projects_status_check';
```
Expected: `def` = `CHECK (status = ANY (ARRAY['available','reserved','sold']))`.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/0006_reserved_status.sql
git commit -m "feat(db): allow 'reserved' project status"
```

---

### Task 2: Vendor supabase-js locally (remove esm.sh runtime dependency)

**Files:**
- Create: `admin/vendor/supabase.js` (vendored ESM build)
- Modify: `admin/db.js:1`

- [ ] **Step 1: Vendor the ESM build**

The package is already installed (`node_modules/@supabase/supabase-js`). Copy its browser ESM bundle into the admin folder:
```bash
mkdir -p admin/vendor
cp node_modules/@supabase/supabase-js/dist/module/index.js admin/vendor/supabase.js 2>/dev/null \
  || node -e "const p=require.resolve('@supabase/supabase-js');console.log('resolve:',p)"
```
If the `dist/module/index.js` path differs, inspect `node_modules/@supabase/supabase-js/package.json` `"exports"`/`"module"` field and copy the referenced ESM entry. The vendored file must be a self-contained ESM bundle (supabase-js ships bundled deps in `dist/module`). If `dist/module` imports sibling files, copy the whole `dist/module/` dir into `admin/vendor/supabase/` and import its `index.js`.

- [ ] **Step 2: Point db.js at the vendored copy**

Modify `admin/db.js` line 1 from:
```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```
to:
```js
import { createClient } from "./vendor/supabase.js";
```
(or `"./vendor/supabase/index.js"` if you copied the directory in Step 1.)

- [ ] **Step 3: Verify the module resolves in a browser context**

Run: `npm run build` then check the file exists in output:
```bash
npm run build && ls dist/admin/vendor/
```
Expected: build succeeds and `dist/admin/vendor/supabase.js` (or `supabase/`) is present (it is copied because `build.mjs:15` copies the whole `admin/` dir).

- [ ] **Step 4: Commit**
```bash
git add admin/vendor admin/db.js
git commit -m "chore(admin): vendor supabase-js, drop esm.sh runtime dependency"
```

> Note: `supabase/functions/publish/index.ts` still imports supabase-js from esm.sh — that is a Deno server context (fine, and out of scope here).

---

### Task 3: Rebuild `admin.css` from the approved mockup

**Files:**
- Rewrite: `admin/admin.css`

- [ ] **Step 1: Port the mockup stylesheet**

Open [docs/superpowers/specs/2026-07-09-rylist-admin-mockup.html](../specs/2026-07-09-rylist-admin-mockup.html). Copy the entire contents of its `<style>…</style>` block into `admin/admin.css`, with these adaptations:
- Remove the `.rl` wrapper prefix that the mockup used for scoping (the admin page is the whole document). Replace the base rule `.rl{…}` with `body{…}` and drop `.rl ` prefixes on descendant selectors, OR keep a top-level `<div class="rl">` wrapper in `index.html` (Task 4) and leave selectors as-is. **Choose the wrapper approach** — it is a smaller diff and avoids cascade surprises.
- Keep the `.admin-login` / `.admin-login[hidden]` / `.admin-app[hidden]` rules from the current `admin/admin.css` (needed for the login gate) — append them, restyled to the new tokens (card on `--surface`, inputs from the mockup `.field` styles).
- Keep the design tokens exactly as in the mockup (`:root`, dark-mode `@media`, `[data-theme]` overrides).

- [ ] **Step 2: Verify no syntax errors**

Run: `npm run build` (the CSS is copied verbatim; build does not lint it, so also eyeball for balanced braces).
Expected: build succeeds; `dist/admin/admin.css` present.

- [ ] **Step 3: Commit**
```bash
git add admin/admin.css
git commit -m "feat(admin): silent-luxury stylesheet (ported from approved mockup)"
```

---

### Task 4: New shell markup — `index.html`

**Files:**
- Rewrite: `admin/index.html`

- [ ] **Step 1: Write the shell**

Replace `admin/index.html` with the login gate + app shell. The `<aside id="side">` is populated by `shell.js`; `<main id="view">` holds the routed content. Wrap everything in `<div class="rl" dir="rtl" lang="ar">` (matches Task 3 selector choice).

```html
<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>RYLIST — لوحة التحكم</title>
<link rel="stylesheet" href="../assets/css/styles.css">
<link rel="stylesheet" href="admin.css">
</head><body>
<div class="rl" dir="rtl" lang="ar">

  <div id="login" class="admin-login">
    <form id="loginForm" class="admin-card">
      <div class="brand"><div class="mark">R</div><div><div class="wm">RYLIST</div><div class="sub">لوحة التحكم</div></div></div>
      <input id="email" type="email" placeholder="البريد" required>
      <input id="password" type="password" placeholder="كلمة المرور" required>
      <button class="btn btn-primary" type="submit">دخول</button>
      <p id="loginErr" class="admin-err"></p>
    </form>
  </div>

  <div id="app" class="shell admin-app" hidden>
    <aside id="side" class="side"></aside>
    <div class="main">
      <div id="topbar" class="topbar"></div>
      <div id="view" class="content"></div>
    </div>
  </div>

</div>
<script type="module" src="app.js"></script>
</body></html>
```

- [ ] **Step 2: Verify**

Run: `npm run build && ls dist/admin/index.html`. Expected: present.

- [ ] **Step 3: Commit**
```bash
git add admin/index.html
git commit -m "feat(admin): new shell markup (sidebar + main)"
```

---

### Task 5: `shell.js` — sidebar + router

**Files:**
- Create: `admin/shell.js`

**Interface it exports:** `mountShell(user, sections)` where `sections` is an array `[{key,label,icon,badge?,render(viewEl)}]`; it renders the sidebar into `#side`, the breadcrumb into `#topbar`, wires nav clicks to swap `#view` (no reload), and renders the publish + signout controls.

- [ ] **Step 1: Write shell.js**

Port the sidebar markup/icons from the mockup (§ SIDEBAR) and the topbar (§ MAIN `.topbar`). Data-drive it from `sections`:

```js
import { signOut } from "./db.js";
import { renderPublish } from "./publish.js";

const ICONS = { // 24x24 stroke paths, copied from the mockup
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  leads:'<path d="M4 4h16v4H4z"/><path d="M4 12h16v8H4z"/>',
  projects:'<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M10 21v-6h4v6"/>',
  news:'<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>',
  partners:'<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5"/><circle cx="17" cy="9" r="2"/>',
  stats:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  pages:'<path d="M4 4h16v16H4z"/><path d="M4 9h16"/>',
  contact:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  social:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
};
const icon = (k)=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${ICONS[k]||ICONS.pages}</svg>`;

export function mountShell(user, sections){
  const side = document.getElementById("side");
  const topbar = document.getElementById("topbar");
  const view = document.getElementById("view");

  side.innerHTML = `
    <div class="brand"><div class="mark">R</div><div><div class="wm">RYLIST</div><div class="sub">لوحة التحكم</div></div></div>
    <div class="navlbl">القسم</div>
    <nav class="nav" id="nav">${sections.map(s=>`
      <a href="#${s.key}" data-key="${s.key}">${icon(s.icon)}${s.label}${s.badge!=null?`<span class="badge">${s.badge}</span>`:""}</a>`).join("")}
    </nav>
    <div class="foot">
      <button class="publish" id="pubBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>نشر الموقع</button>
      <div class="whoami"><span class="av">${(user?.email||"?")[0].toUpperCase()}</span><span>${user?.email||""}</span></div>
      <button class="btn" id="outBtn" style="width:100%">خروج</button>
    </div>`;

  const nav = document.getElementById("nav");
  function route(key){
    const s = sections.find(x=>x.key===key) || sections[0];
    [...nav.children].forEach(a=>a.classList.toggle("active", a.dataset.key===s.key));
    topbar.innerHTML = `<div class="crumb">RYLIST · <b>${s.label}</b></div>`;
    view.innerHTML = "";
    s.render(view);
    if(location.hash!=="#"+s.key) history.replaceState(null,"","#"+s.key);
  }
  nav.addEventListener("click",(e)=>{ const a=e.target.closest("a"); if(!a)return; e.preventDefault(); route(a.dataset.key); });
  document.getElementById("outBtn").onclick = async()=>{ await signOut(); location.reload(); };

  // publish button reuses existing renderPublish logic, mounted into a transient container
  document.getElementById("pubBtn").onclick = ()=> route("publish");

  route((location.hash||"").slice(1) || sections[0].key);
}
```

Note: keep a `publish` section in the sections list (Task 10) so the publish button routes to it and reuses `renderPublish`.

- [ ] **Step 2: Verify (deferred to Task 11 smoke test)** — no standalone test; `shell.js` is exercised once `app.js` wires it.

- [ ] **Step 3: Commit**
```bash
git add admin/shell.js
git commit -m "feat(admin): sidebar + client-side router shell"
```

---

### Task 6: `fields.js` — shared form (lang tabs + ✨ mount point)

**Files:**
- Create: `admin/fields.js`

**Exports:** `renderForm(root, ent, row)` and `uploadImage(prefix, file)` — moved out of the old `ui.js` (`admin/ui.js:45-87`), restyled to the mockup's `.formwrap/.field/.langtabs` classes, and with an **empty `.aibar` container** rendered next to each `i18n-rich`/`i18n-text` field (id `ai-<fieldname>`) as the mount point for Part B.

- [ ] **Step 1: Write fields.js**

Base it on the existing `admin/ui.js:45-87` `renderForm`/`uploadImage` (keep the exact save/insert/update logic and the `localeTabs` helper from `ui.js:8-22`), wrapped in the mockup's form structure. Reuse the tax cache helper from `ui.js:3-5`. Key additions:
- Wrap output in `<div class="formwrap"><div class="fh">…</div><div class="fbody">…</div></div>`.
- For every `i18n-*` field, render `<div class="aibar" id="ai-${f.n.replace('.','_')}" data-field="${f.n}"></div>` **above** the input (empty now; Part B injects ✨ buttons here).
- Style inputs/tabs with the mockup classes (`.field`, `.langtabs`, `textarea`).
- Save/back buttons in a `.savebar`.

(Full source: copy `ui.js` `localeTabs`, `renderForm`, `uploadImage` verbatim, then re-wrap the DOM in the new classes and add the `.aibar` mount `div` in the `i18n-` branch of the field loop.)

- [ ] **Step 2: Commit**
```bash
git add admin/fields.js
git commit -m "feat(admin): shared form component with AI mount points"
```

---

### Task 7: `projects.js` — rich Properties view

**Files:**
- Create: `admin/projects.js`

**Exports:** `renderProjects(root)`.

- [ ] **Step 1: Write projects.js**

Fetch real rows, compute stats, render the mockup's Properties view (stat cards + toolbar + card grid), reusing `renderForm` from `fields.js` for add/edit. Port the card markup, filters, and search from the mockup's `<script>` (§ property grid) but drive it from Supabase data and real taxonomy labels.

```js
import { sb } from "./db.js";
import { ENTITIES } from "./entities.js";
import { renderForm } from "./fields.js";

const AR="٠١٢٣٤٥٦٧٨٩", ar=(n)=>String(n).replace(/[0-9]/g,d=>AR[+d]);
const ST={ available:{t:"متاح",c:"available"}, reserved:{t:"محجوز",c:"reserved"}, sold:{t:"مباع",c:"sold"} };
const ENT = ()=> ENTITIES.find(e=>e.key==="projects");
const money=(n)=>{ if(!n) return ""; const m=n/1e6, s=(Math.round(m*10)/10).toFixed(1).replace(/\.0$/,""); return ar(s); };

export async function renderProjects(root){
  const { data, error } = await sb.from("projects").select("*").order("sort_order",{ascending:true});
  if(error){ root.innerHTML = `<p class="admin-err">${error.message}</p>`; return; }
  const rows = data||[];
  // taxonomy labels
  const { data:tax } = await sb.from("taxonomies").select("*");
  const label=(kind,key)=> (tax||[]).find(t=>t.kind===kind&&t.key===key)?.i18n?.label?.ar || key;
  const count=(s)=> rows.filter(r=>r.status===s).length;

  root.innerHTML = `
    <div class="pagehead">
      <div class="ttl"><h1>العقارات</h1><p>قائمة عقارات مكتبك — تُعرض للعملاء ويُبنى لكل عقار صفحته عند النشر.</p></div>
      <div class="actions">
        <button class="btn" id="addBtn"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>إضافة عقار</button>
      </div>
    </div>
    <div class="countline">إجمالي <b>${ar(rows.length)}</b> عقارات</div>
    <div class="stats">
      <div class="stat total"><div class="lab">كل العقارات</div><div class="val num">${ar(rows.length)}</div></div>
      <div class="stat avail"><div class="lab"><span class="dot"></span>متاح</div><div class="val num">${ar(count("available"))}</div></div>
      <div class="stat res"><div class="lab"><span class="dot"></span>محجوز</div><div class="val num">${ar(count("reserved"))}</div></div>
      <div class="stat sold"><div class="lab"><span class="dot"></span>مباع</div><div class="val num">${ar(count("sold"))}</div></div>
    </div>
    <div class="toolbar">
      <div class="searchbox"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input id="q" placeholder="ابحث في العنوان أو الحي أو الكود…"></div>
      <div class="filters" id="filters">
        <button class="chip on" data-f="all">الكل <span class="n num">${ar(rows.length)}</span></button>
        <button class="chip" data-f="available">متاح <span class="n num">${ar(count("available"))}</span></button>
        <button class="chip" data-f="reserved">محجوز <span class="n num">${ar(count("reserved"))}</span></button>
        <button class="chip" data-f="sold">مباع <span class="n num">${ar(count("sold"))}</span></button>
      </div>
    </div>
    <div class="grid" id="grid"></div>`;

  const grid = root.querySelector("#grid");
  const card=(p)=>{
    const s=ST[p.status]||ST.available;
    const title=p.i18n?.title?.ar || p.code;
    const dist=p.i18n?.district?.ar || "";
    const beds=p.beds_min?`<span class="tag">${ar(p.beds_min)}–${ar(p.beds_max)} غرف</span>`:"";
    const price=p.price_min?`<div class="price">${money(p.price_min)} – ${money(p.price_max||p.price_min)} <span class="u">مليون ر.س</span></div>`:"";
    return `<article class="card" data-status="${p.status}" data-txt="${(title+" "+dist+" "+p.code).toLowerCase()}">
      <div class="ph">${p.image_url?`<img src="${p.image_url}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`:`<div class="pat"></div>`}
        <span class="code">${p.code}</span>${p.featured?'<span class="star">★</span>':''}
        <span class="badge ${s.c}"><span class="d"></span>${s.t}</span></div>
      <div class="bd"><h3>${title}</h3>
        <div class="loc">${dist?dist+" · ":""}${label("city",p.city_key)}</div>
        <div class="metar"><span class="tag">${label("property_type",p.type_key)}</span>${beds}</div>
        ${price}
        <div class="prog"><div class="rowb"><span>نسبة البيع</span><span class="num">${ar(p.sold||0)}٪</span></div>
          <div class="bar"><div class="fill" style="width:${p.sold||0}%"></div></div></div>
        <div class="cta"><button class="mini" data-edit="${p.id}">تعديل</button>
          <button class="mini ai" title="مساعد ذكي (قريبًا)" disabled>✨</button>
          <button class="mini" data-del="${p.id}">حذف</button></div>
      </div></article>`;
  };
  grid.innerHTML = rows.map(card).join("");

  // filters + search (client-side)
  let flt="all", q="";
  const apply=()=>{ [...grid.children].forEach(c=>{
    const okF = flt==="all"||c.dataset.status===flt;
    const okQ = !q||c.dataset.txt.includes(q);
    c.style.display = (okF&&okQ)?"":"none"; }); };
  root.querySelector("#filters").addEventListener("click",(e)=>{ const b=e.target.closest(".chip"); if(!b)return;
    [...b.parent Node?.children||[]]; [...root.querySelectorAll('#filters .chip')].forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); flt=b.dataset.f; apply(); });
  root.querySelector("#q").addEventListener("input",(e)=>{ q=e.target.value.trim().toLowerCase(); apply(); });

  // actions
  root.querySelector("#addBtn").onclick = ()=> renderForm(root, ENT(), {});
  grid.addEventListener("click", async (e)=>{
    const ed=e.target.closest("[data-edit]"), dl=e.target.closest("[data-del]");
    if(ed){ const row=rows.find(r=>r.id===ed.dataset.edit); renderForm(root, ENT(), row); }
    if(dl){ if(!confirm("حذف العقار؟"))return; await sb.from("projects").delete().eq("id", dl.dataset.del); renderProjects(root); }
  });
}
```
> Fix the stray line in the `#filters` handler: it should be exactly `[...root.querySelectorAll('#filters .chip')].forEach(x=>x.classList.remove("on"));` — remove the accidental `b.parentNode` fragment when typing it out.

- [ ] **Step 2: Commit**
```bash
git add admin/projects.js
git commit -m "feat(admin): rich properties view (stats + filters + card grid)"
```

---

### Task 8: `list.js` — generic table for other entities

**Files:**
- Create: `admin/list.js`

**Exports:** `renderList(root, ent)`.

- [ ] **Step 1: Write list.js**

Port `renderList` from the old `admin/ui.js:24-43` (keep the exact fetch/title/delete logic), restyled: page header (`.pagehead` with `<h1>${ent.label}</h1>` + an `#addBtn`), then a `.admin-tbl` table on `--surface`. Delegate add/edit to `renderForm` from `fields.js`. Example header block to prepend:
```js
import { sb } from "./db.js";
import { renderForm } from "./fields.js";
export async function renderList(root, ent){
  root.innerHTML = `<div class="pagehead"><div class="ttl"><h1>${ent.label}</h1></div>
    <div class="actions"><button class="btn btn-primary" id="addBtn">+ إضافة</button></div></div>`;
  root.querySelector("#addBtn").onclick = ()=> renderForm(root, ent, {});
  const { data, error } = await sb.from(ent.table).select("*").order(ent.order,{ascending:true});
  if(error){ root.insertAdjacentHTML("beforeend", `<p class="admin-err">${error.message}</p>`); return; }
  // ...table rows exactly as ui.js:30-42, using renderForm for edit...
}
```

- [ ] **Step 2: Commit**
```bash
git add admin/list.js
git commit -m "feat(admin): generic list view for non-project entities"
```

---

### Task 9: Reformat `leads.js` to the new style

**Files:**
- Modify: `admin/leads.js`

- [ ] **Step 1: Restyle**

Keep all logic in `admin/leads.js` unchanged. Replace the bare `<h2>` header with the `.pagehead` block (`<h1>الطلبات الواردة</h1>` + subtitle "طلبات العملاء من الموقع — غيّر الحالة عند المتابعة."), wrap the empty state (`rows.length===0`) with a friendly `.mocknote`-style card: "لا توجد طلبات بعد — ستظهر هنا فور إرسال أول عميل النموذج." Table keeps class `admin-tbl`.

- [ ] **Step 2: Commit**
```bash
git add admin/leads.js
git commit -m "feat(admin): restyle leads view + empty state"
```

---

### Task 10: Wire modules — `entities.js` + `app.js`

**Files:**
- Modify: `admin/entities.js:6` (status options)
- Rewrite: `admin/app.js`

- [ ] **Step 1: Add `reserved` to the status field options**

In `admin/entities.js`, change the projects `status` field (`entities.js:6`) from:
```js
{n:"status",t:"select",l:"الحالة",options:["available","sold"]},
```
to a labeled select. Since the field renderer shows raw option values, add an option-label map. Simplest within the current renderer: keep values but add Arabic via a parallel `optionLabels`. If the renderer only supports `options:[...]`, use:
```js
{n:"status",t:"select",l:"الحالة",options:["available","reserved","sold"]},
```
(values stay English for DB; Task 6's form can map labels: available→متاح, reserved→محجوز, sold→مباع via a small `STATUS_AR` lookup in `fields.js` applied when `f.n==="status"`.)

- [ ] **Step 2: Rewrite app.js as a thin bootstrap**

```js
import { signIn, currentUser, isAdmin, sb } from "./db.js";
import { ENTITIES } from "./entities.js";
import { renderProjects } from "./projects.js";
import { renderList } from "./list.js";
import { renderLeads } from "./leads.js";
import { renderPublish } from "./publish.js";
import { mountShell } from "./shell.js";

const loginEl=document.getElementById("login"), appEl=document.getElementById("app");

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const { error } = await signIn(email.value, password.value);
  document.getElementById("loginErr").textContent = error ? "بيانات غير صحيحة" : "";
  if(!error) boot();
});

async function sections(){
  // live leads badge (new count)
  let newLeads=0;
  try{ const { count } = await sb.from("leads").select("*",{count:"exact",head:true}).eq("status","new"); newLeads=count||0; }catch{}
  const iconFor = { projects:"projects", news:"news", partners:"partners", stats:"stats", pages:"pages", contact:"contact", social_links:"social" };
  const entitySections = ENTITIES.map(e=>({
    key:e.key, label:e.label, icon:iconFor[e.key]||"pages",
    render:(v)=> e.key==="projects" ? renderProjects(v) : renderList(v, e),
  }));
  return [
    { key:"leads", label:"الطلبات", icon:"leads", badge:newLeads||null, render:(v)=>renderLeads(v) },
    ...entitySections,
    { key:"publish", label:"نشر", icon:"home", render:(v)=>renderPublish(v) },
  ];
}

async function boot(){
  const u = await currentUser();
  if(!u || !(await isAdmin())){ appEl.hidden=true; loginEl.hidden=false; return; }
  loginEl.hidden=true; appEl.hidden=false;
  mountShell(u, await sections());
}
boot();
```

- [ ] **Step 3: Delete the obsolete `ui.js`**

`ui.js` logic now lives in `fields.js` + `list.js`. Remove it:
```bash
git rm admin/ui.js
```

- [ ] **Step 4: Verify build**
```bash
npm run build && ls dist/admin/
```
Expected: success; `app.js shell.js fields.js projects.js list.js leads.js entities.js db.js config.js publish.js admin.css vendor/` present, no `ui.js`.

- [ ] **Step 5: Commit**
```bash
git add admin/entities.js admin/app.js
git commit -m "feat(admin): wire redesigned modules + reserved status option"
```

---

### Task 11: Browser smoke test (staging via publish)

**Files:** none (verification only)

- [ ] **Step 1: Publish and load the panel**

Commit everything so far, push the branch, and either merge to `main` (triggers Vercel) or run the publish button. Then open https://rylist.sa/admin/ (hard refresh `Ctrl+Shift+R`).

- [ ] **Step 2: Run the checklist** (each must pass)
  - Login works; dark sidebar + sections render (AC-A.1).
  - Properties section: 4 stat cards show real counts 9 / 8 / 0 / 1 (AC-A.2).
  - Property cards show images/placeholder, status badge, price, sold % (AC-A.3).
  - Search + filter chips hide/show cards correctly (AC-A.3).
  - Add a test property with status = محجوز; it saves; the "محجوز" stat and filter now show 1 (AC-A.4, AC-A.5 admin side).
  - Edit + delete that test property works.
  - News / Partners / Stats / Pages / Contact / Social render and edit (AC-A.6).
  - Leads shows the empty state.
  - Toggle OS dark mode — panel restyles legibly (AC-A.7).

- [ ] **Step 3: If any check fails**, use `superpowers:systematic-debugging` before patching. Otherwise proceed.

---

### Task 12: Public-site rendering of `reserved`

**Files:**
- Modify: `assets/js/main.js:13-15`, `assets/js/main.js:61-71`, `assets/js/main.js:118-126`
- Modify: `templates/project.html`, `scripts/lib/projectPages.mjs:15-22`
- Modify: the homepage status-filter `<select id="filterStatus">` options (find in `index.html` / page templates)

- [ ] **Step 1: Card badge + label (main.js)**

In `assets/js/main.js`, extend the labels (`main.js:13-15`):
```js
available: { ar: "متاح", en: "Available" },
reserved:  { ar: "محجوز", en: "Reserved" },
sold: { ar: "مباع", en: "Sold" },
```
Replace the binary status logic (`main.js:61-62,71`) with a 3-way map:
```js
var STCLS = { available:"", reserved:"badge--reserved", sold:"badge--sold" };
var statusTxt = t(p.status) || t("available");
// ...in the template string, badge class:
'<span class="badge ' + (STCLS[p.status]||"") + '">' + statusTxt + '</span>' +
```
Add `.badge--reserved` styling to `assets/css/styles.css` (amber, mirroring `.badge--sold`): background/color using `--warning`.

- [ ] **Step 2: Homepage status filter (main.js:118-126 + the select markup)**

Add a `محجوز` option to `<select id="filterStatus">` in the homepage markup (search the repo: `grep -rn 'id="filterStatus"' index.html assets templates`). The existing filter test `p.status === f.status` (`main.js:126`) already handles any value, so only the option needs adding:
```html
<option value="reserved">محجوز</option>
```

- [ ] **Step 3: Project detail page (template + projectPages.mjs)**

In `templates/project.html`, add a status badge after the title:
```html
<p><span class="badge {{statusClass}}">{{statusLabel}}</span></p>
```
In `scripts/lib/projectPages.mjs`, extend the `fill(tmpl,{…})` map (around `projectPages.mjs:15-22`):
```js
statusLabel: ({available:{ar:"متاح",en:"Available",zh:"可售"},reserved:{ar:"محجوز",en:"Reserved",zh:"已预订"},sold:{ar:"مباع",en:"Sold",zh:"已售"}}[p.status]||{})[loc] || "",
statusClass: p.status==="sold"?"badge--sold":(p.status==="reserved"?"badge--reserved":""),
```

- [ ] **Step 4: Verify build renders reserved**

Temporarily set one project to `reserved` (via admin or SQL), then:
```bash
npm run build
grep -rl "محجوز" dist/projects dist/index.html
```
Expected: the reserved project's page and the homepage data include "محجوز". Revert the test project's status if it was only for testing.

- [ ] **Step 5: Commit**
```bash
git add assets/js/main.js assets/css/styles.css templates/project.html scripts/lib/projectPages.mjs index.html
git commit -m "feat(public): render 'reserved' status on cards, filter, and project pages"
```

---

### Task 13: Finish the branch

- [ ] **Step 1:** Re-run `npm run build`; confirm success and no console errors in a local open of `dist/admin/index.html` + `dist/index.html`.
- [ ] **Step 2:** Use `superpowers:finishing-a-development-branch` to merge `feat/admin-redesign-part-a` → `main` (which triggers Vercel deploy) or open a PR, per your preference.
- [ ] **Step 3:** After deploy, run the Task 11 checklist once more against production, plus confirm a `reserved` property shows "محجوز" on the public homepage and its project page (AC-A.5 end-to-end).

---

## Self-Review (author checklist)

- **Spec coverage:** §2 design system → Task 3; §3 architecture/modules → Tasks 4-10; §4 reserved status → Tasks 1,10,12; §5 no-regression → Tasks 8,9,11; §6 ACs → Tasks 7,10,11,12; §7 vendored supabase → Task 2. All covered.
- **Placeholder scan:** No TBD/TODO; code shown for each logic step; view/CSS explicitly delegated to the committed mockup (a concrete artifact, not a placeholder).
- **Type/name consistency:** `renderProjects(root)`, `renderList(root,ent)`, `renderForm(root,ent,row)`, `renderLeads(root)`, `renderPublish(root)`, `mountShell(user,sections)`, section shape `{key,label,icon,badge?,render}` — used consistently across Tasks 5,7,8,9,10.
- **Known typo flagged:** the `#filters` click handler in Task 7 Step 1 contains an intentional correction note — write it as the single clean line shown.
