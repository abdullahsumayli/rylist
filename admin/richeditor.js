import { uploadImage } from "./fields.js";
import { tsvToTableHtml, plainTextToHtml, escapeHtml } from "./editorHtml.js";

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

  // insert arbitrary HTML at the caret, then notify listeners (execCommand fires input,
  // but manual DOM edits below do not — so we dispatch it ourselves for consistency).
  const insertHTML = (html) => { area.focus(); document.execCommand("insertHTML", false, html); };
  const emitInput = () => area.dispatchEvent(new Event("input", { bubbles: true }));

  const btn = (label, title, on) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "rte__btn"; b.textContent = label; b.title = title;
    b.onmousedown = (e) => e.preventDefault();     // keep selection in the editor
    b.onclick = on;
    return b;
  };

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
    const url = await uploadImage(table, f);        // reuses the media-bucket uploader
    if (url) { insertHTML(`<img class="adetail__img" src="${escapeHtml(url)}" alt="">`); emitInput(); }
  };
  wrap.appendChild(fileInput);
  function imageMenu() {
    const how = prompt("اكتب 1 لرفع صورة من جهازك، أو الصق رابط صورة:", "1");
    if (how == null) return;
    if (how.trim() === "1") { fileInput.click(); return; }
    if (/^https?:\/\//i.test(how.trim())) { insertHTML(`<img class="adetail__img" src="${escapeHtml(how.trim())}" alt="">`); emitInput(); }
  }

  // ---- table: starter 2x2, editable cells ----
  function insertStarterTable() {
    const cell = (t) => `<${t}>&nbsp;</${t}>`;
    insertHTML(
      "<table><thead><tr>" + cell("th") + cell("th") + "</tr></thead>" +
      "<tbody><tr>" + cell("td") + cell("td") + "</tr>" +
      "<tr>" + cell("td") + cell("td") + "</tr></tbody></table><p><br></p>");
    emitInput();
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
  const tblBtn = (label, on) => btn(label, label, () => { on(); emitInput(); });
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
      const tbl = cell.closest("table"), idx = Array.from(cell.parentNode.children).indexOf(cell);
      tbl.querySelectorAll("tr").forEach((tr) => {
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
    // Excel/Sheets put a real <table> in text/html; let the browser paste it (the
    // render-time sanitizer strips styling). Otherwise fall back to TSV in text/plain.
    if (html && /<table/i.test(html)) return;
    const tbl = tsvToTableHtml(text);
    if (tbl) { e.preventDefault(); insertHTML(tbl); emitInput(); return; }
    if (/^\s*https?:\/\/\S+\s*$/.test(text)) {               // a single bare url
      e.preventDefault();
      insertHTML(`<a href="${escapeHtml(text.trim())}">${escapeHtml(text.trim())}</a>`);
      emitInput();
      return;
    }
    // plain paste: strip markup to avoid Word/Docs soup
    e.preventDefault();
    document.execCommand("insertText", false, text);
  });

  // Toggle the table controls based on caret position.
  const refreshTools = () => { tableTools.hidden = !cellFromSelection(); };
  area.addEventListener("keyup", refreshTools);
  area.addEventListener("mouseup", refreshTools);

  wrap.append(bar, tableTools, area);

  return {
    el: wrap,
    focus: () => area.focus(),
    getHTML: () => area.innerHTML.trim(),
    setHTML: (html) => { area.innerHTML = plainTextToHtml(html || ""); },
  };
}
