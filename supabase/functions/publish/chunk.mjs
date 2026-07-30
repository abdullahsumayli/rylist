// تقسيم نص المقال إلى قطع صغيرة تُترجَم كلٌّ منها في طلب قصير.
//
// ليش: نص المقال يوصل ٩–١٠ آلاف حرف، وترجمته بطلب واحد تتجاوز دقيقة كاملة
// فتُلغى داخل Edge Function. القطع الصغيرة تُترجَم بالتوازي وتخلص بسرعة.
//
// نصوص المدونة HTML (p, h2, ul/ol, table…) وبعضها سطر واحد طويل بلا أسطر جديدة،
// فالتقسيم يصير عند نهاية عناصر المستوى الأعلى فقط — ما ينكسر جدول ولا قائمة
// ولا فقرة داخل خلية. لو ما أمكن التقسيم بأمان، يرجع النص كقطعة واحدة.

const CONTAINER = /^(?:ul|ol|table|blockquote|figure|dl|details)$/;
const BLOCK = /^(?:p|h[1-6]|ul|ol|table|blockquote|figure|pre|dl|details)$/;

// يقسّم HTML عند نهاية كل عنصر من عناصر المستوى الأعلى (خارج أي حاوية).
// القطع متلاصقة: ربطها يعيد النص الأصلي حرفًا بحرف.
export function splitBlocks(html) {
  const s = String(html || "");
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  const out = [];
  let depth = 0, last = 0, m;
  while ((m = re.exec(s))) {
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (CONTAINER.test(name)) depth = closing ? Math.max(0, depth - 1) : depth + 1;
    if (closing && depth === 0 && BLOCK.test(name)) {
      const end = m.index + m[0].length;
      out.push(s.slice(last, end));
      last = end;
    }
  }
  if (last < s.length) out.push(s.slice(last));
  return out.filter((b) => b !== "");
}

// يقسّم نصًا عاديًا عند الأسطر الفارغة، وإلا عند كل سطر جديد. الفواصل تبقى ملتصقة
// بالفقرة اللي قبلها حتى يرجع النص كما هو عند الربط.
export function splitParagraphs(text) {
  const s = String(text || "");
  if (!s) return [];
  const parts = s.split(/\n\s*\n/.test(s) ? /(\n\s*\n)/ : /(\n)/);
  const out = [];
  for (let i = 0; i < parts.length; i += 2) {
    const block = (parts[i] ?? "") + (parts[i + 1] ?? "");
    if (block) out.push(block);
  }
  return out;
}

// يرجّع قطعًا طول كل وحدة ≤ maxChars ما أمكن (عنصر أطول من السقف يبقى وحده).
// ضمانة صارمة: chunks.join("") === النص الأصلي — وإلا يرجع النص كقطعة واحدة.
export function chunkForTranslation(text, maxChars = 1800) {
  const s = String(text || "");
  if (!s.trim()) return [];
  if (s.length <= maxChars) return [s];

  const isHtml = /<[a-zA-Z][^>]*>/.test(s);
  let blocks = isHtml ? splitBlocks(s) : splitParagraphs(s);
  if (blocks.length < 2 || blocks.join("") !== s) blocks = splitParagraphs(s);
  if (blocks.length < 2 || blocks.join("") !== s) return [s];   // ما نقدر نقسّم بأمان

  const chunks = [];
  let cur = "";
  for (const b of blocks) {
    if (cur && cur.length + b.length > maxChars) { chunks.push(cur); cur = b; }
    else cur += b;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
