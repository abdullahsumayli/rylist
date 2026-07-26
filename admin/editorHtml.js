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
