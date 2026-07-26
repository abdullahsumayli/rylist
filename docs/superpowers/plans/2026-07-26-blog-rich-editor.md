# Blog Rich Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin blog editor inline images (upload + URL), Excel-like tables (manual + paste), and clickable links (button + auto-link), storing sanitized HTML in the existing `news.i18n.body` column.

**Architecture:** A custom vanilla `contenteditable` editor (`admin/richeditor.js`) replaces the body `<textarea>` and emits HTML into `i18n.body[locale]` (no schema change). Both render paths — static build (`scripts/lib/renderArticle.mjs`) and client preview (`assets/js/main.js`) — pass the HTML through an allowlist **sanitizer** before injecting it, so preview and published output are identical and safe. Pure string helpers (linkify, Excel-TSV→table, legacy-text→HTML) live in `admin/editorHtml.js` and are unit-tested.

**Tech Stack:** Vanilla ES modules (browser admin, no bundler), Node ESM build scripts, `node:test`, `node-html-parser` (already a devDependency), Supabase Storage (`media` bucket via existing `uploadImage()`).

---

## Design reference

Spec: `docs/superpowers/specs/2026-07-26-blog-rich-editor-design.md`

## File Structure

- **Create** `scripts/lib/sanitizeHtml.mjs` — Node allowlist sanitizer (build side). Pure.
- **Create** `scripts/lib/sanitizeHtml.test.mjs` — sanitizer tests.
- **Create** `admin/editorHtml.js` — pure string helpers: `linkify`, `tsvToTableHtml`, `plainTextToHtml`, `escapeHtml`. Zero imports so both browser and node can load it.
- **Create** `admin/editorHtml.test.mjs` — helper tests.
- **Create** `admin/richeditor.js` — the contenteditable editor component (browser).
- **Modify** `package.json:5` — extend the test glob to include `admin/**/*.test.mjs`.
- **Modify** `scripts/lib/renderArticle.mjs:27-36` — run `formatBody`'s HTML branch through the sanitizer.
- **Modify** `scripts/lib/renderArticle.test.mjs` — add sanitize/passthrough assertions.
- **Modify** `assets/js/main.js:168-210` — client sanitizer + `formatBody` sanitize (preview parity).
- **Modify** `admin/fields.js:21-51` — swap textarea → richeditor for `i18n-rich`.
- **Modify** `admin/admin.css` — toolbar + editable-area styles.
- **Modify** `assets/css/styles.css:347-354` — body `img` + `table` styles.

**Allowlist (single source of truth, used by all sanitizers):**
- Tags: `p h2 h3 h4 ul ol li a img table thead tbody tr td th strong em b i br figure figcaption blockquote`
- Attributes: `a` → `href` (only `http:`/`https:`/`mailto:`); `img` → `src` (only `http:`/`https:`/`data:image/`), `alt`; `td`/`th` → `colspan`, `rowspan`; any element → `class` (only names starting `adetail__`).
- Dropped entirely (tag + contents): `script`, `style`.
- Unwrapped (drop tag, keep sanitized children): any other non-allowlisted tag (e.g. `div`, `span`, `iframe`).
- `a` gets `target="_blank" rel="noopener nofollow"` added.

---

## Task 1: Node sanitizer (build side)

**Files:**
- Create: `scripts/lib/sanitizeHtml.mjs`
- Test: `scripts/lib/sanitizeHtml.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/sanitizeHtml.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtml } from "./sanitizeHtml.mjs";

test("keeps allowlisted tags and text", () => {
  assert.equal(sanitizeHtml("<p>hi <strong>there</strong></p>"), "<p>hi <strong>there</strong></p>");
});

test("drops script and style entirely, including their text", () => {
  assert.equal(sanitizeHtml('<p>ok</p><script>alert(1)</script>'), "<p>ok</p>");
  assert.equal(sanitizeHtml('<style>body{}</style><p>ok</p>'), "<p>ok</p>");
});

test("unwraps non-allowlisted tags but keeps their text", () => {
  assert.equal(sanitizeHtml("<div><span>keep</span></div>"), "keep");
  assert.equal(sanitizeHtml('<iframe src="evil"></iframe><p>ok</p>'), "<p>ok</p>");
});

test("strips event handlers and javascript: urls", () => {
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)" onclick="x()">t</a>'),
    '<a target="_blank" rel="noopener nofollow">t</a>');
});

test("keeps safe href and adds target/rel to links", () => {
  assert.equal(sanitizeHtml('<a href="https://a.com">go</a>'),
    '<a href="https://a.com" target="_blank" rel="noopener nofollow">go</a>');
});

test("keeps img with http/https/data-image src, drops other src", () => {
  assert.equal(sanitizeHtml('<img src="https://x/i.png" alt="a">'), '<img src="https://x/i.png" alt="a">');
  assert.equal(sanitizeHtml('<img src="javascript:x" alt="a">'), '<img alt="a">');
});

test("keeps tables with colspan/rowspan, drops other attrs", () => {
  assert.equal(
    sanitizeHtml('<table><tbody><tr><td colspan="2" bgcolor="red">c</td></tr></tbody></table>'),
    '<table><tbody><tr><td colspan="2">c</td></tr></tbody></table>');
});

test("keeps only adetail__ class names", () => {
  assert.equal(sanitizeHtml('<img class="adetail__img evil" src="https://x/i.png" alt="">'),
    '<img class="adetail__img" src="https://x/i.png" alt="">');
  assert.equal(sanitizeHtml('<p class="evil">x</p>'), "<p>x</p>");
});

test("escapes stray angle brackets and ampersands in text", () => {
  assert.equal(sanitizeHtml("a < b & c"), "a &lt; b &amp; c");
});

test("empty / nullish input returns empty string", () => {
  assert.equal(sanitizeHtml(""), "");
  assert.equal(sanitizeHtml(null), "");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/sanitizeHtml.test.mjs`
Expected: FAIL — `Cannot find module './sanitizeHtml.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/sanitizeHtml.mjs`:

```js
// Allowlist HTML sanitizer for admin-authored article bodies.
// Parses with node-html-parser, then rebuilds a safe HTML string (we never
// re-serialize the parser's tree — we emit only tags/attrs we explicitly allow).
import { parse } from "node-html-parser";

const ALLOWED = new Set([
  "p", "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "table", "thead",
  "tbody", "tr", "td", "th", "strong", "em", "b", "i", "br", "figure",
  "figcaption", "blockquote",
]);
const DROP = new Set(["script", "style"]);          // remove tag AND its text
const VOID = new Set(["img", "br"]);
const SAFE_HREF = /^(https?:|mailto:)/i;
const SAFE_SRC = /^(https?:|data:image\/)/i;

const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function keepClass(v) {
  const kept = String(v).split(/\s+/).filter((c) => c.startsWith("adetail__"));
  return kept.length ? kept.join(" ") : null;
}

// Build the allowed attribute string for one element (tag already lowercased).
function attrsFor(tag, attrs) {
  const out = [];
  const get = (k) => attrs[k] ?? attrs[k.toLowerCase()];
  if (tag === "a") {
    const href = get("href");
    if (href && SAFE_HREF.test(href.trim())) out.push(`href="${escAttr(href.trim())}"`);
    out.push('target="_blank"', 'rel="noopener nofollow"');
  }
  if (tag === "img") {
    const src = get("src");
    if (src && SAFE_SRC.test(src.trim())) out.push(`src="${escAttr(src.trim())}"`);
    const alt = get("alt");
    out.push(`alt="${escAttr(alt || "")}"`);
  }
  if (tag === "td" || tag === "th") {
    for (const k of ["colspan", "rowspan"]) {
      const v = get(k);
      if (v && /^\d+$/.test(String(v).trim())) out.push(`${k}="${escAttr(v.trim())}"`);
    }
  }
  const cls = get("class");
  if (cls) { const kc = keepClass(cls); if (kc) out.push(`class="${escAttr(kc)}"`); }
  return out.length ? " " + out.join(" ") : "";
}

function walk(node) {
  // text node
  if (node.nodeType === 3) return escText(node.rawText);
  // element node
  if (node.nodeType === 1) {
    const tag = String(node.rawTagName || "").toLowerCase();
    if (!tag) return node.childNodes.map(walk).join("");
    if (DROP.has(tag)) return "";
    const inner = node.childNodes.map(walk).join("");
    if (!ALLOWED.has(tag)) return inner;                 // unwrap unknown tags
    if (VOID.has(tag)) return `<${tag}${attrsFor(tag, node.attributes)}>`;
    return `<${tag}${attrsFor(tag, node.attributes)}>${inner}</${tag}>`;
  }
  return "";
}

export function sanitizeHtml(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  const root = parse(s, { comment: false });
  return root.childNodes.map(walk).join("");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/sanitizeHtml.test.mjs`
Expected: PASS (all tests). If `rawTagName`/`attributes` shape differs, log one parsed node (`console.log(parse("<a href=x>y</a>").childNodes[0])`) and adjust property names — node-html-parser exposes `nodeType`, `rawTagName`, `attributes` (plain object), `rawText`, `childNodes`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sanitizeHtml.mjs scripts/lib/sanitizeHtml.test.mjs
git commit -m "feat(blog): allowlist HTML sanitizer for article bodies"
```

---

## Task 2: Sanitize in the static build render path

**Files:**
- Modify: `scripts/lib/renderArticle.mjs:27-36`
- Test: `scripts/lib/renderArticle.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/renderArticle.test.mjs`:

```js
test("formatBody sanitizes HTML bodies (drops script, adds link rel)", () => {
  const out = formatBody('<p>hi</p><script>alert(1)</script><a href="https://x.com">L</a>', "t");
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /<a href="https:\/\/x\.com" target="_blank" rel="noopener nofollow">L<\/a>/);
});

test("formatBody still wraps legacy plain text in paragraphs", () => {
  assert.equal(formatBody("one\n\ntwo", "t"), "<p>one</p><p>two</p>");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/renderArticle.test.mjs`
Expected: FAIL — the sanitize test fails (`<script>` still present, no `rel`).

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/renderArticle.mjs`, add the import near the top (after line 6):

```js
import { sanitizeHtml } from "./sanitizeHtml.mjs";
```

Replace the HTML-passthrough line inside `formatBody` (currently line 30):

```js
  if (/<(p|h[1-6]|ul|ol|div|br)\b/i.test(s)) return s;              // already HTML — leave it
```

with:

```js
  if (/<(p|h[1-6]|ul|ol|div|br|table|img|a|blockquote|figure)\b/i.test(s)) return sanitizeHtml(s);  // HTML — sanitize
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/lib/renderArticle.test.mjs`
Expected: PASS (including the two new tests and all existing ones — note the existing test at line 30 `formatBody("<p>hi</p>")` still returns `<p>hi</p>` because `<p>` is allowlisted).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/renderArticle.mjs scripts/lib/renderArticle.test.mjs
git commit -m "feat(blog): sanitize HTML article bodies at build time"
```

---

## Task 3: Pure editor helpers (linkify, Excel paste, legacy load)

**Files:**
- Create: `admin/editorHtml.js`
- Test: `admin/editorHtml.test.mjs`
- Modify: `package.json:5`

- [ ] **Step 1: Extend the test glob**

In `package.json`, change the `test` script (line 5) from:

```json
"test": "node --test scripts/**/*.test.mjs",
```

to:

```json
"test": "node --test scripts/**/*.test.mjs admin/**/*.test.mjs",
```

- [ ] **Step 2: Write the failing test**

Create `admin/editorHtml.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { linkify, tsvToTableHtml, plainTextToHtml, escapeHtml } from "./editorHtml.js";

test("escapeHtml escapes the dangerous trio", () => {
  assert.equal(escapeHtml('a<b>&"'), 'a&lt;b&gt;&amp;&quot;');
});

test("linkify wraps bare urls, leaves text alone", () => {
  assert.equal(linkify("see https://a.com now"),
    'see <a href="https://a.com">https://a.com</a> now');
  assert.equal(linkify("no links here"), "no links here");
});

test("linkify does not double-wrap and escapes surrounding text", () => {
  assert.equal(linkify("a & https://x.com"), 'a &amp; <a href="https://x.com">https://x.com</a>');
});

test("tsvToTableHtml builds a table; first row is a header", () => {
  const html = tsvToTableHtml("a\tb\n1\t2");
  assert.equal(html,
    "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
});

test("tsvToTableHtml escapes cell content and ignores trailing blank lines", () => {
  const html = tsvToTableHtml("x<i>\ty\n\n");
  assert.match(html, /<th>x&lt;i&gt;<\/th>/);
});

test("tsvToTableHtml returns empty string when there is no tab", () => {
  assert.equal(tsvToTableHtml("just one line no tabs"), "");
});

test("plainTextToHtml wraps blocks in <p>, single newline -> <br>", () => {
  assert.equal(plainTextToHtml("one\ntwo\n\nthree"), "<p>one<br>two</p><p>three</p>");
  assert.equal(plainTextToHtml(""), "");
});

test("plainTextToHtml leaves existing block HTML untouched", () => {
  assert.equal(plainTextToHtml("<p>hi</p>"), "<p>hi</p>");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test admin/editorHtml.test.mjs`
Expected: FAIL — `Cannot find module './editorHtml.js'`.

- [ ] **Step 4: Write minimal implementation**

Create `admin/editorHtml.js` (zero imports — loadable in the browser and by node):

```js
// Pure string helpers for the rich editor. No DOM, no imports — safe to unit-test
// under node and to `import` from the browser admin.

export const escapeHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;

// Escape text, then turn bare http(s) urls into <a href> links.
export function linkify(text) {
  const raw = String(text || "");
  let out = "", last = 0, m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(raw))) {
    out += escapeHtml(raw.slice(last, m.index));
    const url = m[0];
    out += `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
    last = m.index + url.length;
  }
  out += escapeHtml(raw.slice(last));
  return out;
}

// Tab-separated text (as produced by copying an Excel / Google Sheets range) → table.
// Returns "" when the text has no tab (i.e. not a spreadsheet paste).
export function tsvToTableHtml(tsv) {
  const rows = String(tsv || "").replace(/\r/g, "").split("\n").filter((r) => r.length);
  if (!rows.length || !rows.some((r) => r.includes("\t"))) return "";
  const cells = rows.map((r) => r.split("\t"));
  const head = cells[0].map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = cells.slice(1)
    .map((r) => "<tr>" + r.map((c) => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>")
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// Legacy plain-text body → editable HTML (mirrors formatBody's plain-text branch).
// Existing block HTML is returned unchanged.
export function plainTextToHtml(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (/<(p|h[1-6]|ul|ol|div|br|table|img|a|blockquote|figure)\b/i.test(s)) return s;
  return s.split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test admin/editorHtml.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add admin/editorHtml.js admin/editorHtml.test.mjs package.json
git commit -m "feat(blog): pure editor helpers (linkify, excel-paste, legacy load)"
```

---

## Task 4: Public CSS for inline images and tables

**Files:**
- Modify: `assets/css/styles.css:347-354`

- [ ] **Step 1: Add image + table rules**

After the existing `.adetail__body a { color: var(--gold-deep); }` line (line 354), insert:

```css
.adetail__body img, .adetail__body .adetail__img { max-width: 100%; height: auto; border-radius: 10px; margin: var(--sp-4) 0; display: block; }
.adetail__body figure { margin: var(--sp-4) 0; }
.adetail__body figcaption { font-size: 0.9rem; color: var(--text-mid); margin-top: var(--sp-2); text-align: center; }
.adetail__body table { border-collapse: collapse; width: 100%; margin: var(--sp-4) 0; font-size: 0.98rem; }
.adetail__body th, .adetail__body td { border: 1px solid var(--line, #e5e5e5); padding: var(--sp-2) var(--sp-3); text-align: start; }
.adetail__body thead th { background: var(--bg-soft, #f6f6f6); font-weight: 600; }
.adetail__body blockquote { margin: var(--sp-4) 0; padding-inline-start: var(--sp-4); border-inline-start: 3px solid var(--gold-deep); color: var(--text-mid); }
```

- [ ] **Step 2: Verify the build still emits the CSS**

Run: `node scripts/build.mjs`
Expected: build completes; `dist/assets/css/styles.css` contains `.adetail__body table`. Check:
Run: `node -e "const s=require('fs').readFileSync('dist/assets/css/styles.css','utf8');console.log(s.includes('.adetail__body table'))"`
Expected: `true`.

- [ ] **Step 3: Commit**

```bash
git add assets/css/styles.css
git commit -m "feat(blog): style inline images and tables in article body"
```

---

## Task 5: Client preview parity (sanitize in main.js)

**Files:**
- Modify: `assets/js/main.js:168-210`

The preview page must render byte-identically to the published page, so it needs the same allowlist sanitizer. The browser has a DOM, so implement it with a detached element + `DOMParser` walk (no node-html-parser in the browser).

- [ ] **Step 1: Add a browser sanitizer above `formatBody` (before line 173)**

```js
  /* ===== منقّي HTML (نفس قائمة السماح في scripts/lib/sanitizeHtml.mjs) ===== */
  var SAN_ALLOWED = { p:1,h2:1,h3:1,h4:1,ul:1,ol:1,li:1,a:1,img:1,table:1,thead:1,tbody:1,tr:1,td:1,th:1,strong:1,em:1,b:1,i:1,br:1,figure:1,figcaption:1,blockquote:1 };
  var SAN_DROP = { script:1, style:1 };
  var SAN_VOID = { img:1, br:1 };
  function sanUrl(v, re) { v = String(v || "").trim(); return re.test(v) ? v : ""; }
  function sanClass(v) { return String(v||"").split(/\s+/).filter(function(c){return c.indexOf("adetail__")===0;}).join(" "); }
  function sanWalk(node) {
    if (node.nodeType === 3) return esc(node.nodeValue);
    if (node.nodeType !== 1) return "";
    var tag = node.tagName.toLowerCase();
    if (SAN_DROP[tag]) return "";
    var inner = ""; for (var i=0;i<node.childNodes.length;i++) inner += sanWalk(node.childNodes[i]);
    if (!SAN_ALLOWED[tag]) return inner;
    var attrs = "";
    if (tag === "a") { var h = sanUrl(node.getAttribute("href"), /^(https?:|mailto:)/i); if (h) attrs += ' href="'+esc(h)+'"'; attrs += ' target="_blank" rel="noopener nofollow"'; }
    if (tag === "img") { var s = sanUrl(node.getAttribute("src"), /^(https?:|data:image\/)/i); if (s) attrs += ' src="'+esc(s)+'"'; attrs += ' alt="'+esc(node.getAttribute("alt")||"")+'"'; }
    if (tag === "td" || tag === "th") { ["colspan","rowspan"].forEach(function(k){ var v=node.getAttribute(k); if (v && /^\d+$/.test(v)) attrs += ' '+k+'="'+esc(v)+'"'; }); }
    var cls = sanClass(node.getAttribute("class")); if (cls) attrs += ' class="'+esc(cls)+'"';
    if (SAN_VOID[tag]) return "<"+tag+attrs+">";
    return "<"+tag+attrs+">"+inner+"</"+tag+">";
  }
  function sanitizeHtml(html) {
    var s = String(html || "").trim(); if (!s) return "";
    var doc = new DOMParser().parseFromString(s, "text/html");
    var out = ""; var kids = doc.body.childNodes;
    for (var i=0;i<kids.length;i++) out += sanWalk(kids[i]);
    return out;
  }
```

- [ ] **Step 2: Route the HTML branch of `formatBody` through it**

In `assets/js/main.js`, change the passthrough line inside `formatBody` (line 176) from:

```js
    if (/<(p|h[1-6]|ul|ol|div|br)\b/i.test(s)) return s;              // HTML جاهز — اتركه
```

to:

```js
    if (/<(p|h[1-6]|ul|ol|div|br|table|img|a|blockquote|figure)\b/i.test(s)) return sanitizeHtml(s);  // HTML — نقّه
```

- [ ] **Step 3: Manual verification**

Run: `node scripts/build.mjs` then open `dist/article.html?preview=1` after setting a draft (see Task 9 QA). Confirm a body with `<script>` is stripped and links get `target="_blank"`.
Quick smoke without a browser:
Run: `node -e "1"` (placeholder — this step is browser-verified in Task 9).

- [ ] **Step 4: Commit**

```bash
git add assets/js/main.js
git commit -m "feat(blog): sanitize HTML body in client preview for parity"
```

---

## Task 6: The rich editor component

**Files:**
- Create: `admin/richeditor.js`

This is browser DOM code (no unit test harness exists for admin DOM in this repo — verified manually in Task 9). It reuses `uploadImage` from `fields.js` and the pure helpers from `editorHtml.js`.

- [ ] **Step 1: Create the component**

Create `admin/richeditor.js`:

```js
import { uploadImage } from "./fields.js";
import { linkify, tsvToTableHtml, plainTextToHtml, escapeHtml } from "./editorHtml.js";

// Builds one rich-text editor bound to a single locale value.
// opts: { table } — Supabase table name used as the upload path prefix (e.g. "news").
// Returns { el, getHTML(), setHTML(html), focus() }.
export function richEditor(opts = {}) {
  const table = opts.table || "news";
  const wrap = document.createElement("div");
  wrap.className = "rte";

  const bar = document.createElement("div");
  bar.className = "rte__bar";

  const area = document.createElement("div");
  area.className = "rte__area adetail__body";
  area.contentEditable = "true";

  // exec is the pragmatic path for inline formatting in a contenteditable.
  const exec = (cmd, val) => { area.focus(); document.execCommand(cmd, false, val); };

  const btn = (label, title, on) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rte__btn"; b.textContent = label; b.title = title;
    b.onmousedown = (e) => e.preventDefault();     // keep selection in the editor
    b.onclick = on;
    return b;
  };

  // insert arbitrary HTML at the caret
  const insertHTML = (html) => { area.focus(); document.execCommand("insertHTML", false, html); };

  bar.append(
    btn("B", "عريض", () => exec("bold")),
    btn("I", "مائل", () => exec("italic")),
    btn("H2", "عنوان", () => exec("formatBlock", "H2")),
    btn("H3", "عنوان فرعي", () => exec("formatBlock", "H3")),
    btn("• قائمة", "قائمة نقطية", () => exec("insertUnorderedList")),
    btn("1. قائمة", "قائمة مرقمة", () => exec("insertOrderedList")),
    btn("🔗 رابط", "رابط", () => {
      const url = prompt("رابط (https://…):", "https://");
      if (url && /^https?:\/\//i.test(url)) exec("createLink", url);
    }),
    btn("🖼️ صورة", "صورة", () => imageMenu()),
    btn("▦ جدول", "جدول", () => insertStarterTable()),
  );

  // ---- image: upload from device or paste a URL ----
  const fileInput = document.createElement("input");
  fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.hidden = true;
  fileInput.onchange = async () => {
    const f = fileInput.files[0]; fileInput.value = "";
    if (!f) return;
    const url = await uploadImage(table, f);       // reuses the media-bucket uploader
    if (url) insertHTML(`<img class="adetail__img" src="${escapeHtml(url)}" alt="">`);
  };
  wrap.appendChild(fileInput);
  function imageMenu() {
    const how = prompt("اكتب 1 لرفع صورة من جهازك، أو الصق رابط صورة:", "1");
    if (how == null) return;
    if (how.trim() === "1") { fileInput.click(); return; }
    if (/^https?:\/\//i.test(how.trim())) insertHTML(`<img class="adetail__img" src="${escapeHtml(how.trim())}" alt="">`);
  }

  // ---- table: starter 2x2, editable cells ----
  function insertStarterTable() {
    const cell = (t) => `<${t}>&nbsp;</${t}>`;
    insertHTML(
      "<table><thead><tr>" + cell("th") + cell("th") + "</tr></thead>" +
      "<tbody><tr>" + cell("td") + cell("td") + "</tr>" +
      "<tr>" + cell("td") + cell("td") + "</tr></tbody></table><p><br></p>");
  }

  // Row/column controls: shown when the caret is inside a table cell.
  const tableTools = document.createElement("div");
  tableTools.className = "rte__tabletools"; tableTools.hidden = true;
  const cellFromSelection = () => {
    const sel = window.getSelection(); if (!sel || !sel.anchorNode) return null;
    let n = sel.anchorNode;
    while (n && n !== area) { if (n.nodeType === 1 && /^(TD|TH)$/.test(n.tagName)) return n; n = n.parentNode; }
    return null;
  };
  const tblBtn = (label, on) => btn(label, label, on);
  tableTools.append(
    tblBtn("+ صف", () => {
      const cell = cellFromSelection(); if (!cell) return;
      const row = cell.parentNode, cols = row.children.length;
      const tr = document.createElement("tr");
      for (let i = 0; i < cols; i++) { const td = document.createElement("td"); td.innerHTML = "&nbsp;"; tr.appendChild(td); }
      row.parentNode.insertBefore(tr, row.nextSibling);
    }),
    tblBtn("+ عمود", () => {
      const cell = cellFromSelection(); if (!cell) return;
      const table = cell.closest("table"), idx = Array.from(cell.parentNode.children).indexOf(cell);
      table.querySelectorAll("tr").forEach((tr) => {
        const isHead = tr.parentNode.tagName === "THEAD";
        const c = document.createElement(isHead ? "th" : "td"); c.innerHTML = "&nbsp;";
        tr.insertBefore(c, tr.children[idx + 1] || null);
      });
    }),
    tblBtn("حذف صف", () => { const cell = cellFromSelection(); if (cell && cell.closest("tr")) cell.closest("tr").remove(); }),
    tblBtn("حذف الجدول", () => { const cell = cellFromSelection(); if (cell && cell.closest("table")) cell.closest("table").remove(); }),
  );

  // ---- paste: Excel table (TSV/HTML) or bare url, else plain text ----
  area.addEventListener("paste", (e) => {
    const cd = e.clipboardData; if (!cd) return;
    const html = cd.getData("text/html");
    const text = cd.getData("text/plain");
    // Excel/Sheets put a real <table> in text/html; fall back to TSV in text/plain.
    if (html && /<table/i.test(html)) return;               // let the browser paste it; sanitizer cleans on render
    const tbl = tsvToTableHtml(text);
    if (tbl) { e.preventDefault(); insertHTML(tbl); return; }
    if (/^\s*https?:\/\/\S+\s*$/.test(text)) {               // a single bare url
      e.preventDefault();
      insertHTML(`<a href="${escapeHtml(text.trim())}">${escapeHtml(text.trim())}</a>`);
      return;
    }
    // plain paste: strip markup to avoid Word/Docs soup
    e.preventDefault();
    document.execCommand("insertText", false, text);
  });

  // Auto-link a just-typed bare url when the user hits space/enter.
  area.addEventListener("keyup", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    // (kept minimal: full-body linkify runs on getHTML; here we only refresh tools)
    tableTools.hidden = !cellFromSelection();
  });
  area.addEventListener("mouseup", () => { tableTools.hidden = !cellFromSelection(); });

  wrap.append(bar, tableTools, area);

  return {
    el: wrap,
    focus: () => area.focus(),
    getHTML: () => area.innerHTML.trim(),
    setHTML: (html) => { area.innerHTML = plainTextToHtml(html || ""); },
  };
}
```

- [ ] **Step 2: Sanity check the module parses**

Run: `node --check admin/richeditor.js`
Expected: no output (syntax OK). (It imports browser-only `./fields.js`; do not execute it under node — `--check` only parses.)

- [ ] **Step 3: Commit**

```bash
git add admin/richeditor.js
git commit -m "feat(blog): contenteditable rich editor (images, tables, links)"
```

---

## Task 7: Wire the editor into the admin form

**Files:**
- Modify: `admin/fields.js:21-51`

- [ ] **Step 1: Import the editor**

At the top of `admin/fields.js`, after the existing imports (line 3), add:

```js
import { richEditor } from "./richeditor.js";
```

- [ ] **Step 2: Use it for `i18n-rich`, keep textarea for other rich? (there is only body)**

Replace the body of `localeTabs` (lines 21-51) with a version that builds a `richEditor` when `field.t === "i18n-rich"` and keeps the plain input otherwise:

```js
export function localeTabs(field, value, onLocale) {
  const wrap = document.createElement("div");
  const tabs = document.createElement("div"); tabs.className = "langtabs";
  const pane = document.createElement("div");
  let cur = LOCALES[0].code;
  const rich = field.t === "i18n-rich";
  let ctl = null;   // current control: {get,set} for rich, or the input element

  const draw = () => {
    pane.innerHTML = "";
    if (rich) {
      const ed = richEditor({ table: "news" });
      ed.setHTML((value && value[cur]) || "");
      ed.el.addEventListener("input", () => onLocale(cur, ed.getHTML()));
      // contenteditable fires "input" on the area; capture it as it bubbles to ed.el
      pane.appendChild(ed.el);
      ctl = { get: () => ed.getHTML(), set: (v) => ed.setHTML(v) };
    } else {
      const inp = document.createElement("input");
      inp.value = (value && value[cur]) || "";
      inp.oninput = () => onLocale(cur, inp.value);
      pane.appendChild(inp);
      ctl = { get: () => inp.value, set: (v) => { inp.value = v; } };
    }
  };

  LOCALES.forEach((L) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = tabLabel(L.code);
    if (L.code === cur) b.classList.add("on");
    b.onclick = () => {
      if (ctl) onLocale(cur, ctl.get());              // flush current locale before switching
      cur = L.code; [...tabs.children].forEach((c) => c.classList.remove("on")); b.classList.add("on"); draw();
    };
    tabs.appendChild(b);
  });
  wrap.append(tabs, pane); draw();
  return {
    el: wrap,
    current: () => cur,
    setText: (loc, text) => { onLocale(loc, text); if (loc === cur && ctl) ctl.set(text); },
  };
}
```

Note: the `richEditor` area bubbles a native `input` event on typing; `ed.el.addEventListener("input", …)` catches it so `onLocale` keeps the draft in sync. Toolbar actions (`execCommand`) also fire `input`, so images/tables/links persist to the draft too.

- [ ] **Step 3: Sanity check**

Run: `node --check admin/fields.js`
Expected: no output (syntax OK).

- [ ] **Step 4: Commit**

```bash
git add admin/fields.js
git commit -m "feat(blog): use rich editor for the article body field"
```

---

## Task 8: Admin editor styling

**Files:**
- Modify: `admin/admin.css` (near the `.richbody` rule, ~line 219)

- [ ] **Step 1: Add editor chrome styles**

After the `.field textarea.richbody{…}` rule (line 219), add:

```css
  .rte{border:1px solid var(--line,#e3e3e3);border-radius:10px;overflow:hidden;background:#fff}
  .rte__bar{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-bottom:1px solid var(--line,#e3e3e3);background:var(--bg-soft,#fafafa)}
  .rte__tabletools{display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-bottom:1px dashed var(--line,#e3e3e3);background:#fff}
  .rte__btn{padding:5px 10px;border-radius:7px;font-size:13px;font-weight:600;color:var(--text-1,#222);border:1px solid var(--line,#e3e3e3);background:#fff;cursor:pointer}
  .rte__btn:hover{background:var(--bg-soft,#f2f2f2)}
  .rte__area{min-height:360px;padding:14px 16px;line-height:1.9;outline:none;overflow:auto}
  .rte__area:focus{box-shadow:inset 0 0 0 2px rgba(0,0,0,.04)}
  .rte__area table{border-collapse:collapse;width:100%;margin:10px 0}
  .rte__area th,.rte__area td{border:1px solid #ddd;padding:6px 8px;min-width:40px}
  .rte__area img{max-width:100%;height:auto;border-radius:8px;margin:8px 0}
  .rte__area:empty::before{content:attr(data-ph);color:#aaa}
```

- [ ] **Step 2: Verify (visual — full check in Task 9)**

Run: `node --check admin/admin.css` is not valid (CSS). Instead just confirm the file saved and the selectors exist:
Run: `node -e "const s=require('fs').readFileSync('admin/admin.css','utf8');console.log(s.includes('.rte__bar')&&s.includes('.rte__area'))"`
Expected: `true`.

- [ ] **Step 3: Commit**

```bash
git add admin/admin.css
git commit -m "feat(blog): style the rich editor toolbar and editable area"
```

---

## Task 9: Full verification + manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests pass — `sanitizeHtml.test.mjs`, `editorHtml.test.mjs`, `renderArticle.test.mjs`, and the pre-existing suites. Zero failures.

- [ ] **Step 2: Build the site**

Run: `node scripts/build.mjs`
Expected: completes without error; `dist/` regenerated.

- [ ] **Step 3: Manual admin QA (browser)**

Serve the repo root (e.g. `npx serve .` or the existing local flow) and open `admin/`. In a news article, per locale (ع / EN / 中文):
- Type text, bold/italic, add an H2, add a bullet list.
- Insert an inline image via **upload** → confirm it uploads to the `media` bucket and appears.
- Insert an inline image via **URL**.
- Insert a table, add a row and a column, type in cells.
- Copy a small range from Excel/Google Sheets and paste → confirm a table appears.
- Paste a bare `https://…` URL → confirm it becomes a clickable link.
- Switch language tabs and back → confirm each locale keeps its own content.
- Click **معاينة** → confirm the preview page matches what you authored, RTL correct for Arabic.

- [ ] **Step 4: Verify sanitization end-to-end**

In the editor, use the browser devtools to set a body containing `<script>alert(1)</script>` (or paste HTML with an `onclick`), Preview, and confirm the script/handler does not appear/run in `article.html?preview=1`. Then publish to a draft and rebuild; confirm the static page is clean too.

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to choose merge/PR. Suggested PR title:
`feat(blog): rich article editor — inline images, tables, clickable links`
PR body should link the spec (`docs/superpowers/specs/2026-07-26-blog-rich-editor-design.md`) and this plan.

---

## Self-Review notes

- **Spec coverage:** inline images (Task 6 image menu + Task 4 CSS), tables manual + Excel-paste (Task 6 table tools + Task 3 `tsvToTableHtml`), links button + auto-link (Task 6 link button/paste + Task 3 `linkify`), sanitizer both paths (Tasks 1/2 build, Task 5 preview), no-iframe (allowlist unwraps `iframe`), legacy plain-text load (Task 3 `plainTextToHtml`, used in Task 7), CSS both admin + public (Tasks 8 + 4), tests (Tasks 1/2/3). `excerptFrom` already strips tags — no change needed (noted in spec §5, already true in `dataJs.mjs:18`).
- **Type/name consistency:** `sanitizeHtml` (Node) / `sanitizeHtml` (browser copy) same name, same allowlist; `richEditor()` returns `{el,getHTML,setHTML,focus}` and Task 7 consumes exactly those; helper names `linkify`/`tsvToTableHtml`/`plainTextToHtml`/`escapeHtml` match between `editorHtml.js` and its test and `richeditor.js`.
- **Known limitation (acceptable):** `admin/richeditor.js` DOM behavior is verified manually (Task 9), not unit-tested — the repo has no browser test harness; the risky pure logic is extracted into `editorHtml.js` and unit-tested.
