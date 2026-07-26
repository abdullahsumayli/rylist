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
  const cls = get("class");
  if (cls) { const kc = keepClass(cls); if (kc) out.push(`class="${escAttr(kc)}"`); }
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
