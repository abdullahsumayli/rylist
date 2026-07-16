# Admin Project Content Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin panel a dedicated editor so the team can manage a project's gallery, internal units (with per-unit images + floorplan + specs + price), facts, features, location points, and unit types — all trilingual (ar/en/zh).

**Architecture:** A new `admin/content.js` module renders a collapsible section editor launched from a "المحتوى" button on each project card. Pure data helpers live in `admin/content-data.js` (no browser deps, unit-tested under `node --test`). Saving writes only the `gallery` and `details` columns, loaded fresh and edited on a deep clone, so untouched keys survive.

**Tech Stack:** Vanilla ES-module JS + Supabase JS client (existing `admin/db.js`), `node --test` for the pure layer.

**Spec:** [docs/superpowers/specs/2026-07-16-admin-project-content-editor-design.md](../specs/2026-07-16-admin-project-content-editor-design.md)

---

## File Structure

- **Create** `admin/content-data.js` — pure factories (`blankI18n`, `blankPair`, `blankUnit`, `blankUnitType`) + `buildPayload(draft)`. No imports. Testable in Node.
- **Create** `scripts/content-data.test.mjs` — `node --test` suite for `content-data.js`.
- **Create** `admin/content.js` — DOM editor: primitives (`i18nField`, `imageInput`, `galleryEditor`, `pairsEditor`, `stringsEditor`, `collapsible`, `unitsSection`) + exported `renderProjectContent`.
- **Modify** `admin/fields.js` — export `localeTabs` (currently module-private).
- **Modify** `admin/list.js` — add "المحتوى" button to the project card + wire it to `renderProjectContent`.
- **Modify** `admin/admin.css` — styles for the content editor.

Data shapes (all `i18n = { ar, en, zh }`):
- `gallery: string[]`
- `details.facts: {label:i18n, value:i18n}[]`
- `details.units: {title:i18n, description:i18n, price:i18n, specs:{label:i18n,value:i18n}[], gallery:string[], floorplan:string}[]`
- `details.features: i18n[]`
- `details.location: i18n[]`
- `details.unitTypes: {title:i18n, detail:i18n}[]`

---

## Task 1: Pure data layer (`content-data.js`) — TDD

**Files:**
- Create: `admin/content-data.js`
- Test: `scripts/content-data.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/content-data.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, blankI18n, blankPair, blankUnit, blankUnitType } from "../admin/content-data.js";

test("buildPayload preserves untouched details keys", () => {
  const draft = { gallery: [], details: { unitTypes: [{ a: 1 }], custom: "keep" } };
  const { details } = buildPayload(draft);
  assert.deepEqual(details.unitTypes, [{ a: 1 }]);
  assert.equal(details.custom, "keep");
});

test("buildPayload filters empty/whitespace gallery urls", () => {
  const draft = { gallery: ["a", "", "   ", "b"], details: {} };
  assert.deepEqual(buildPayload(draft).gallery, ["a", "b"]);
});

test("buildPayload tolerates missing gallery/details", () => {
  const { gallery, details } = buildPayload({});
  assert.deepEqual(gallery, []);
  assert.deepEqual(details, {});
});

test("blank factories produce the trilingual shapes", () => {
  assert.deepEqual(blankI18n(), { ar: "", en: "", zh: "" });
  assert.deepEqual(Object.keys(blankPair()).sort(), ["label", "value"]);
  assert.deepEqual(Object.keys(blankUnitType()).sort(), ["detail", "title"]);
  assert.deepEqual(Object.keys(blankUnit()).sort(), ["description", "floorplan", "gallery", "price", "specs", "title"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/content-data.test.mjs`
Expected: FAIL — `Cannot find module '.../admin/content-data.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `admin/content-data.js`:

```js
// admin/content-data.js — pure data helpers for the project content editor.
// NO browser / DOM / Supabase imports — safe to unit-test under `node --test`.

export const blankI18n = () => ({ ar: "", en: "", zh: "" });
export const blankPair = () => ({ label: blankI18n(), value: blankI18n() });
export const blankUnitType = () => ({ title: blankI18n(), detail: blankI18n() });
export const blankUnit = () => ({
  title: blankI18n(), description: blankI18n(), price: blankI18n(),
  specs: [], gallery: [], floorplan: "",
});

// buildPayload(draft) -> { gallery, details }
// draft = { gallery:[...], details:{...} } loaded full from DB and edited in place.
// Returns only the two persisted columns, preserving every details key we never edited.
export function buildPayload(draft) {
  const gallery = (draft?.gallery || []).filter((u) => typeof u === "string" && u.trim() !== "");
  const details = { ...(draft?.details || {}) };
  return { gallery, details };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/content-data.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add admin/content-data.js scripts/content-data.test.mjs
git commit -m "feat(admin): pure data layer for project content editor"
```

---

## Task 2: Export `localeTabs` from `fields.js`

**Files:**
- Modify: `admin/fields.js:20`

- [ ] **Step 1: Make `localeTabs` exported**

In `admin/fields.js`, change the declaration on line 20 from:

```js
function localeTabs(field, value, onLocale) {
```

to:

```js
export function localeTabs(field, value, onLocale) {
```

No other change — the function body and its existing internal use in `renderForm` stay identical.

- [ ] **Step 2: Verify syntax**

Run: `node --check admin/fields.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add admin/fields.js
git commit -m "refactor(admin): export localeTabs for reuse"
```

---

## Task 3: `content.js` scaffold + image/i18n/gallery primitives

**Files:**
- Create: `admin/content.js`

- [ ] **Step 1: Create `content.js` with imports, shared helpers, and the first three primitives**

Create `admin/content.js`:

```js
import { sb } from "./db.js";
import { uploadImage, localeTabs } from "./fields.js";
import { blankI18n, blankPair, blankUnit, blankUnitType, buildPayload } from "./content-data.js";

const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

// reorder (▲▼) + delete (🗑) tool cluster shared by every list editor.
function rowTools(arr, i, render, confirmMsg) {
  const tools = el("div", "ci-tools");
  const up = el("button", "btn ci-mini", "▲"); up.type = "button"; up.disabled = i === 0;
  up.onclick = () => { move(arr, i, -1); render(); };
  const down = el("button", "btn ci-mini", "▼"); down.type = "button"; down.disabled = i === arr.length - 1;
  down.onclick = () => { move(arr, i, 1); render(); };
  const del = el("button", "btn ci-mini", "🗑"); del.type = "button";
  del.onclick = () => { if (!confirm(confirmMsg || "حذف؟")) return; arr.splice(i, 1); render(); };
  tools.append(up, down, del);
  return tools;
}

// i18nField(value, rich?) -> element. `value` is an i18n object mutated in place.
function i18nField(value, rich = false) {
  const tabs = localeTabs({ t: rich ? "i18n-rich" : "i18n-text" }, value, (loc, val) => { value[loc] = val; });
  return tabs.el;
}

// imageInput(getVal, setVal, prefix) -> element for a single image (thumb + url + upload).
function imageInput(getVal, setVal, prefix) {
  const box = el("div", "ci-imageinput");
  const row = el("div", "ci-gallery-row");
  const thumb = document.createElement("img"); thumb.className = "ci-thumb"; thumb.alt = ""; thumb.src = getVal() || "";
  const input = document.createElement("input"); input.value = getVal() || ""; input.placeholder = "رابط الصورة";
  input.oninput = () => { setVal(input.value); thumb.src = input.value; };
  row.append(thumb, input);
  const up = document.createElement("input"); up.type = "file"; up.accept = "image/*";
  const status = el("p", "uploadstatus"); status.hidden = true;
  up.onchange = async () => {
    const file = up.files[0]; if (!file) return;
    up.disabled = true; status.hidden = false; status.className = "uploadstatus is-busy"; status.textContent = "⏳ جارٍ الرفع…";
    const url = await uploadImage(prefix, file);
    up.disabled = false; up.value = "";
    if (url) { input.value = url; setVal(url); thumb.src = url; status.className = "uploadstatus is-ok"; status.textContent = "✓ تم الرفع"; }
    else { status.className = "uploadstatus is-err"; status.textContent = "✗ تعذّر الرفع"; }
  };
  box.append(row, up, status);
  return box;
}

// galleryEditor(arr, prefix) -> element. arr is an array of URL strings, mutated in place.
function galleryEditor(arr, prefix) {
  const wrap = el("div", "ci-list");
  const listEl = el("div");
  const render = () => {
    listEl.innerHTML = "";
    arr.forEach((url, i) => {
      const row = el("div", "ci-gallery-row");
      const thumb = document.createElement("img"); thumb.className = "ci-thumb"; thumb.alt = ""; thumb.src = url || "";
      const input = document.createElement("input"); input.value = url || ""; input.placeholder = "رابط الصورة";
      input.oninput = () => { arr[i] = input.value; thumb.src = input.value; };
      row.append(thumb, input, rowTools(arr, i, render, "حذف الصورة؟"));
      listEl.appendChild(row);
    });
  };
  const actions = el("div", "ci-actions");
  const up = document.createElement("input"); up.type = "file"; up.accept = "image/*";
  const status = el("p", "uploadstatus"); status.hidden = true;
  up.onchange = async () => {
    const file = up.files[0]; if (!file) return;
    up.disabled = true; status.hidden = false; status.className = "uploadstatus is-busy"; status.textContent = "⏳ جارٍ الرفع…";
    const url = await uploadImage(prefix, file);
    up.disabled = false; up.value = "";
    if (url) { arr.push(url); render(); status.className = "uploadstatus is-ok"; status.textContent = "✓ تم الرفع"; }
    else { status.className = "uploadstatus is-err"; status.textContent = "✗ تعذّر الرفع"; }
  };
  const addUrl = el("button", "btn", "+ رابط"); addUrl.type = "button";
  addUrl.onclick = () => { arr.push(""); render(); };
  actions.append(up, addUrl, status);
  wrap.append(listEl, actions); render();
  return wrap;
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check admin/content.js`
Expected: no output (exit 0). (`--check` parses ES-module syntax without resolving the browser imports.)

- [ ] **Step 3: Commit**

```bash
git add admin/content.js
git commit -m "feat(admin): content editor primitives (i18n, image, gallery)"
```

---

## Task 4: `content.js` — pairs, strings, and collapsible section

**Files:**
- Modify: `admin/content.js` (append functions before any exported function)

- [ ] **Step 1: Append `pairsEditor`, `stringsEditor`, and `collapsible`**

Add to `admin/content.js` (after `galleryEditor`):

```js
// pairsEditor(arr, aKey, bKey, aLabel, bLabel, mkBlank) -> element.
// arr is an array of { [aKey]:i18n, [bKey]:i18n } mutated in place.
function pairsEditor(arr, aKey, bKey, aLabel, bLabel, mkBlank) {
  const wrap = el("div", "ci-list");
  const listEl = el("div");
  const render = () => {
    listEl.innerHTML = "";
    arr.forEach((pair, i) => {
      pair[aKey] = pair[aKey] || blankI18n();
      pair[bKey] = pair[bKey] || blankI18n();
      const row = el("div", "ci-pair-row");
      const a = el("div", "ci-col"); a.append(el("label", "ci-lbl", aLabel), i18nField(pair[aKey]));
      const b = el("div", "ci-col"); b.append(el("label", "ci-lbl", bLabel), i18nField(pair[bKey]));
      row.append(a, b, rowTools(arr, i, render, "حذف الصف؟"));
      listEl.appendChild(row);
    });
  };
  const add = el("button", "btn", "+ صف"); add.type = "button";
  add.onclick = () => { arr.push(mkBlank()); render(); };
  wrap.append(listEl, add); render();
  return wrap;
}

// stringsEditor(arr) -> element. arr is an array of i18n objects mutated in place.
function stringsEditor(arr) {
  const wrap = el("div", "ci-list");
  const listEl = el("div");
  const render = () => {
    listEl.innerHTML = "";
    arr.forEach((val, i) => {
      if (!val || typeof val !== "object") arr[i] = blankI18n();
      const row = el("div", "ci-string-row");
      const c = el("div", "ci-col"); c.append(i18nField(arr[i]));
      row.append(c, rowTools(arr, i, render, "حذف السطر؟"));
      listEl.appendChild(row);
    });
  };
  const add = el("button", "btn", "+ سطر"); add.type = "button";
  add.onclick = () => { arr.push(blankI18n()); render(); };
  wrap.append(listEl, add); render();
  return wrap;
}

// collapsible(icon, title, countFn, bodyFn) -> element with a lazily-built body.
// The returned element carries `_refreshCount()` to update its counter.
function collapsible(icon, title, countFn, bodyFn) {
  const sec = el("div", "ci-sec");
  const head = el("button", "ci-sec-head"); head.type = "button";
  const caret = el("span", "ci-caret", "▸");
  const label = el("span", "ci-sec-title", `${icon} ${title}`);
  const count = el("span", "ci-sec-count");
  const setCount = () => { count.textContent = `(${countFn()})`; };
  head.append(caret, label, count);
  const body = el("div", "ci-sec-body"); body.hidden = true;
  let built = false;
  head.onclick = () => {
    body.hidden = !body.hidden;
    caret.textContent = body.hidden ? "▸" : "▾";
    if (!built && !body.hidden) { body.appendChild(bodyFn()); built = true; }
    setCount();
  };
  setCount();
  sec.append(head, body);
  sec._refreshCount = setCount;
  return sec;
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check admin/content.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add admin/content.js
git commit -m "feat(admin): pairs/strings editors + collapsible section"
```

---

## Task 5: `content.js` — units section + `renderProjectContent`

**Files:**
- Modify: `admin/content.js` (append `unitsSection`, then the exported `renderProjectContent`)

- [ ] **Step 1: Append `unitsSection` and `renderProjectContent`**

Add to `admin/content.js` (after `collapsible`):

```js
// unitsSection(units, prefix) -> element. List view + per-unit edit view (in-place swap).
function unitsSection(units, prefix) {
  const wrap = el("div", "ci-units");
  const listView = el("div");
  const editView = el("div"); editView.hidden = true;
  wrap.append(listView, editView);

  const showList = () => {
    editView.hidden = true; listView.hidden = false; listView.innerHTML = "";
    units.forEach((u, i) => {
      u.title = u.title || blankI18n();
      const row = el("div", "ci-unit-row");
      const name = el("span", "ci-unit-name", u.title.ar || u.title.en || `وحدة ${i + 1}`);
      const edit = el("button", "btn ci-mini", "تعديل"); edit.type = "button"; edit.onclick = () => showEdit(i);
      row.append(name, edit, rowTools(units, i, showList, "حذف الوحدة؟"));
      listView.appendChild(row);
    });
    const add = el("button", "btn btn-primary", "+ وحدة"); add.type = "button";
    add.onclick = () => { units.push(blankUnit()); showEdit(units.length - 1); };
    listView.appendChild(add);
  };

  const showEdit = (i) => {
    const u = units[i];
    u.title = u.title || blankI18n(); u.description = u.description || blankI18n(); u.price = u.price || blankI18n();
    u.specs = u.specs || []; u.gallery = u.gallery || []; if (u.floorplan == null) u.floorplan = "";
    listView.hidden = true; editView.hidden = false; editView.innerHTML = "";
    const field = (lbl, node) => { const d = el("div", "ci-field"); d.append(el("label", "ci-lbl", lbl), node); return d; };
    editView.append(
      el("h3", "ci-unit-h", `الوحدة ${i + 1}`),
      field("العنوان", i18nField(u.title)),
      field("الوصف", i18nField(u.description, true)),
      field("السعر", i18nField(u.price)),
      field("المواصفات", pairsEditor(u.specs, "label", "value", "المسمّى", "القيمة", blankPair)),
      field("معرض صور الوحدة", galleryEditor(u.gallery, prefix)),
      field("المخطط", imageInput(() => u.floorplan || "", (v) => { u.floorplan = v; }, prefix)),
    );
    const done = el("button", "btn btn-primary", "تم"); done.type = "button"; done.onclick = showList;
    editView.appendChild(done);
  };

  showList();
  return wrap;
}

// renderProjectContent(root, project, onDone) — the content editor screen.
export async function renderProjectContent(root, project, onDone) {
  const finish = () => { if (typeof onDone === "function") onDone(); };
  root.innerHTML = `<div class="formwrap">
      <div class="fh"><h2>${(project.code || "المشروع")} — المحتوى والوحدات</h2></div>
      <div class="fbody" id="cbody"><p class="muted">جارٍ التحميل…</p></div>
    </div>`;
  const cbody = root.querySelector("#cbody");

  const { data, error } = await sb.from("projects").select("gallery, details").eq("id", project.id).single();
  if (error) { cbody.innerHTML = `<p class="admin-err">${error.message}</p>`; return; }

  const draft = {
    gallery: Array.isArray(data.gallery) ? JSON.parse(JSON.stringify(data.gallery)) : [],
    details: data.details ? JSON.parse(JSON.stringify(data.details)) : {},
  };
  const d = draft.details;
  d.facts = d.facts || []; d.units = d.units || []; d.features = d.features || [];
  d.location = d.location || []; d.unitTypes = d.unitTypes || [];
  const prefix = "projects";

  cbody.innerHTML = "";
  const secs = [
    collapsible("📸", "معرض المشروع", () => draft.gallery.length, () => galleryEditor(draft.gallery, prefix)),
    collapsible("📊", "الحقائق", () => d.facts.length, () => pairsEditor(d.facts, "label", "value", "المسمّى", "القيمة", blankPair)),
    collapsible("🏠", "الوحدات", () => d.units.length, () => unitsSection(d.units, prefix)),
    collapsible("✨", "المميزات", () => d.features.length, () => stringsEditor(d.features)),
    collapsible("📍", "الموقع", () => d.location.length, () => stringsEditor(d.location)),
    collapsible("🏘", "أنواع الوحدات", () => d.unitTypes.length, () => pairsEditor(d.unitTypes, "title", "detail", "العنوان", "التفصيل", blankUnitType)),
  ];
  secs.forEach((s) => cbody.appendChild(s));

  const savebar = el("div", "savebar");
  const save = el("button", "btn btn-primary", "حفظ"); save.type = "button";
  const back = el("button", "btn", "رجوع"); back.type = "button";
  savebar.append(save, back); cbody.appendChild(savebar);

  back.onclick = finish;
  save.onclick = async () => {
    save.disabled = true;
    const payload = buildPayload(draft);
    const res = await sb.from("projects").update(payload).eq("id", project.id);
    save.disabled = false;
    if (res.error) { alert(res.error.message); return; }
    secs.forEach((s) => s._refreshCount && s._refreshCount());
    alert("تم الحفظ ✓");
    finish();
  };
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check admin/content.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add admin/content.js
git commit -m "feat(admin): units section + renderProjectContent screen"
```

---

## Task 6: Wire the "المحتوى" button into the project card

The project grid (cards with تعديل/حذف) is rendered by `admin/projects.js`. `admin/list.js` is only the generic table for the *other* entities — do NOT touch it.

**Files:**
- Modify: `admin/projects.js:1-3` (imports), `admin/projects.js:68-70` (card CTA), `admin/projects.js:95-99` (grid click handler)

- [ ] **Step 1: Import the new module**

In `admin/projects.js`, after the existing imports (lines 1-3), add:

```js
import { renderProjectContent } from "./content.js";
```

- [ ] **Step 2: Add the button to the card CTA row**

In `admin/projects.js`, replace the `.cta` block (lines 68-70) with:

```js
        <div class="cta"><button class="mini" data-edit="${esc(p.id)}">تعديل</button>
          <button class="mini" data-content="${esc(p.id)}">المحتوى</button>
          <button class="mini" data-del="${esc(p.id)}">حذف</button></div>
```

(The disabled `✨` "مساعد ذكي (قريبًا)" button is removed to make room; "المحتوى" replaces it.)

- [ ] **Step 3: Handle the click in the grid listener**

In `admin/projects.js`, replace the `grid.addEventListener("click", …)` handler (lines 95-99) with:

```js
  grid.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]"), ct = e.target.closest("[data-content]");
    if (ed) { const row = rows.find((r) => String(r.id) === ed.dataset.edit); renderForm(root, ENT(), row, () => renderProjects(root)); }
    if (ct) { const row = rows.find((r) => String(r.id) === ct.dataset.content); renderProjectContent(root, row, () => renderProjects(root)); }
    if (dl) { if (!confirm("حذف العقار؟")) return; const { error: e2 } = await sb.from("projects").delete().eq("id", dl.dataset.del); if (e2) { alert(e2.message); return; } renderProjects(root); }
  });
```

(`renderProjects` is the exported function in this same file, so it is already in scope.)

- [ ] **Step 4: Verify syntax**

Run: `node --check admin/projects.js`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add admin/projects.js
git commit -m "feat(admin): add المحتوى button to project cards"
```

---

## Task 7: Styles for the content editor

**Files:**
- Modify: `admin/admin.css` (append at end)

- [ ] **Step 1: Append styles**

Append to `admin/admin.css`:

```css
/* ---- project content editor ---- */
.ci-body { display: flex; flex-direction: column; gap: 10px; }
.ci-sec { border: 1px solid var(--line, #e5e2dc); border-radius: 10px; overflow: hidden; }
.ci-sec-head { width: 100%; display: flex; align-items: center; gap: 8px; padding: 12px 14px;
  background: var(--surface-2, #faf9f6); border: 0; cursor: pointer; font: inherit; text-align: start; }
.ci-caret { width: 14px; color: var(--text-3, #999); }
.ci-sec-title { font-weight: 600; }
.ci-sec-count { color: var(--text-3, #999); font-variant-numeric: tabular-nums; }
.ci-sec-body { padding: 14px; border-top: 1px solid var(--line, #e5e2dc); }
.ci-list { display: flex; flex-direction: column; gap: 12px; }
.ci-pair-row, .ci-string-row, .ci-gallery-row, .ci-unit-row {
  display: flex; gap: 10px; align-items: flex-start; }
.ci-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.ci-lbl { font-size: 12px; color: var(--text-2, #666); }
.ci-tools { display: flex; gap: 4px; flex-shrink: 0; }
.ci-mini { padding: 4px 8px; font-size: 13px; }
.ci-thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; flex-shrink: 0;
  background: var(--surface-2, #faf9f6); }
.ci-gallery-row input, .ci-imageinput input { flex: 1; }
.ci-actions { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.ci-unit-row { align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line, #e5e2dc); }
.ci-unit-name { flex: 1; font-weight: 500; }
.ci-unit-h { margin: 0 0 10px; }
.ci-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.ci-imageinput { display: flex; flex-direction: column; gap: 6px; }
```

- [ ] **Step 2: Commit**

```bash
git add admin/admin.css
git commit -m "style(admin): content editor styles"
```

---

## Task 8: Manual QA verification

No DOM test harness (jsdom) exists in this repo, so the editor is verified by exercising it against a real project. The automated safety net is Task 1's `buildPayload` tests + the `node --check` syntax gates.

- [ ] **Step 1: Re-run the pure tests**

Run: `node --test scripts/content-data.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 2: Serve the site locally**

Run: `node scripts/build.mjs` (if the admin is served from build output) OR serve the repo root with any static server, e.g. `npx serve .` , then open `/admin/` in a browser and log in.

- [ ] **Step 3: Smoke-test each section on a real project**

Open a project (e.g. NAJD-2) → click **المحتوى**, then verify:
- معرض المشروع: existing images show; add via upload, add via "+ رابط", reorder ▲▼, delete 🗑.
- الحقائق / أنواع الوحدات: pair rows show ar/en values; add/edit/reorder/delete.
- الوحدات: list shows all 28; open one → title/description/price tabs (ع/EN/中文), specs, gallery, floorplan all editable; "+ وحدة" then "تم" returns to list.
- المميزات / الموقع: string rows editable; add/reorder/delete.
- Click **حفظ** → "تم الحفظ ✓".

- [ ] **Step 4: Confirm the save was surgical (no data loss)**

Before saving, note the project's `details.unitTypes`. After saving a change to `features` only, run in Supabase:

```sql
select jsonb_array_length(details->'unitTypes') as unittypes,
       jsonb_array_length(details->'units') as units,
       jsonb_array_length(gallery) as gallery
from projects where code = 'NAJD-2';
```

Expected: `unitTypes` and `units` counts unchanged; the edited column reflects your change.

- [ ] **Step 5: Confirm the public page**

Click the admin **نشر** button, wait for the deploy, and open the project's public page — the edited content (new gallery image / unit / feature) appears.

- [ ] **Step 6: Final commit (if any QA fixes were needed)**

```bash
git add -A
git commit -m "fix(admin): content editor QA fixes"
```

---

## Self-Review Notes

- **Spec coverage:** gallery ✅ (Task 3 galleryEditor + Task 5 section), units w/ images+floorplan+specs+price ✅ (Task 5 unitsSection), facts ✅, features ✅ (stringsEditor), location ✅, unitTypes ✅, trilingual ✅ (i18nField via localeTabs over LOCALES ar/en/zh), save safety ✅ (buildPayload + write only gallery/details, Task 1 test proves key preservation), reuse of existing primitives ✅ (uploadImage, localeTabs), no publish-path change ✅.
- **Placeholder scan:** none — every code step is complete.
- **Type consistency:** `blankPair` → `{label,value}` matches `pairsEditor(..., "label", "value", ...)` for facts/specs; `blankUnitType` → `{title,detail}` matches `pairsEditor(..., "title", "detail", ...)` for unitTypes; `blankUnit` keys match `unitsSection` usage; `buildPayload(draft)` signature matches its caller in `renderProjectContent`.
- **Card location:** The project card lives in `admin/projects.js` (not `list.js`); Task 6 targets `projects.js` and `renderProjects` is in-scope there.
