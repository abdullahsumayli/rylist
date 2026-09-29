import fs from "node:fs";
import path from "node:path";

/**
 * مرآةُ الوسائط — تُنزل كلَّ صورةٍ مستضافةٍ على تخزين Supabase إلى المستودع، وتعيد كتابة
 * روابطها إلى مسارٍ محلي قبل أن تُخبز في الصفحات.
 *
 * **لماذا:** المشروعُ على الخطة المجانية، وهي توقف المشروع تلقائياً بعد أسبوعٍ بلا نشاط.
 * وقد وقع (٢٩ سبتمبر ٢٠٢٦): نامَ المشروع فصار مضيفُه لا يحلّ أصلاً، فاختفت صورُ الأخبار من
 * الموقع المنشور — والنصوص باقيةٌ لأنها مخبوزةٌ وقت البناء، والصور وحدها كانت روابط حيّة.
 *
 * فبعد هذه المرآة لا يحتاج **الموقعُ المنشور** Supabase إطلاقاً في التصفّح؛ يحتاجه البناء
 * واللوحة وحدهما. ونومُ المشروع يمنع نشرةً جديدة ولا يُعطب المنشورةَ القائمة.
 *
 * **والمسار جذريٌّ لا نسبي** (`/assets/...`): صفحات المقالات تُكتب في `news/` وفي
 * `<locale>/news/`، فمسارٌ نسبيٌّ واحد لا يصحّ من العمقين معاً.
 */

const STORAGE_MARK = "/storage/v1/object/public/";
const DIR = "assets/img";

/** الاسم المحلي لرابطٍ بعيد — `…/public/media/news/a.jpg` ⇐ `news/a.jpg`. وغيرُ المخزَّن يُترك. */
export function localNameFor(url) {
  if (typeof url !== "string") return null;
  const at = url.indexOf(STORAGE_MARK);
  if (at < 0 || !url.startsWith("https://")) return null;
  const tail = url.slice(at + STORAGE_MARK.length).split(/[?#]/)[0];
  // أول جزءٍ هو اسم الحاوية (`media`) ولا يدخل المسار المحلي
  const parts = tail.split("/").slice(1).filter(Boolean).map((s) => decodeURIComponent(s));
  if (parts.length === 0) return null;
  // حارسٌ ضدّ الخروج من المجلد — اسمُ ملفٍ من القاعدة لا يُوثق به
  if (parts.some((p) => p === "." || p === ".." || p.includes("\\"))) return null;
  return parts.join("/");
}

export const hrefFor = (name) => `/${DIR}/${name}`;

/** صيغٌ يجوز أن يحلّ بها بديلٌ مُحسَّن محلَّ الأصل — الترتيب ترتيبُ الأفضلية */
const TWINS = [".webp", ".jpg", ".png"];

/**
 * الملفُّ الموجود فعلاً لهذا الاسم — **وبديلُه المُحسَّن يسبق الأصل**.
 *
 * صورةُ خبرٍ فوتوغرافية رُفعت PNG تزن أضعافَ ما تزنه JPEG بالأبعاد نفسها (٣٫٧ ميجابايت مقابل
 * ربعِ ميجابايت قياساً على أخواتها). فإن وُضع بجوارها بديلٌ بالامتداد الأخفّ، أشارت الصفحاتُ
 * إليه — واسمُ الأصل في القاعدة لا يتغيّر، فلا لمسَ للوحة ولا للبيانات.
 */
export function resolveExisting(root, name) {
  const base = name.replace(/\.[^./]+$/, "");
  for (const ext of TWINS) {
    const candidate = `${base}${ext}`;
    if (fs.existsSync(path.join(root, DIR, candidate))) return candidate;
  }
  return fs.existsSync(path.join(root, DIR, name)) ? name : null;
}

/** يمشي في الشجرة فيبدّل كلَّ رابطٍ ورد في `map`. نقيّة — لا قرص ولا شبكة. */
export function rewriteTree(node, map) {
  if (typeof node === "string") return map.get(node) ?? node;
  if (Array.isArray(node)) return node.map((v) => rewriteTree(v, map));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = rewriteTree(v, map);
    return out;
  }
  return node;
}

/** كلُّ روابط التخزين الواردة في الشجرة، بلا تكرار. */
export function collectUrls(node, found = new Set()) {
  if (typeof node === "string") { if (localNameFor(node)) found.add(node); return found; }
  if (Array.isArray(node)) { for (const v of node) collectUrls(v, found); return found; }
  if (node && typeof node === "object") { for (const v of Object.values(node)) collectUrls(v, found); return found; }
  return found;
}

/**
 * يُنزل ما ينقص ويعيد المحتوى بروابط محلية.
 *
 * **والموجودُ لا يُعاد تنزيله**: الملفات مدفوعةٌ في المستودع، فالبناء المعتاد لا يلمس الشبكة —
 * وهو ما يجعل البناء ينجح ولو كان التخزين نائماً. والتنزيل يقع لصورةٍ جديدةٍ وحدها.
 *
 * **وفشلُ تنزيلٍ لا يُسقط البناء**: الرابط يبقى بعيداً كما كان (السلوك القديم) ويُطبع تحذير —
 * فصورةٌ واحدةٌ متعذّرة أهون من نشرةٍ كاملةٍ لا تخرج.
 */
export async function mirrorMedia(content, opts = {}) {
  const root = opts.root ?? ".";
  const fetchImpl = opts.fetch ?? fetch;
  const log = opts.log ?? console.log;
  const map = new Map();

  for (const url of collectUrls(content)) {
    const name = localNameFor(url);
    if (!name) continue;
    const have = resolveExisting(root, name);
    if (have) { map.set(url, hrefFor(have)); continue; }
    const dest = path.join(root, DIR, name);
    try {
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      log(`mirrored → ${DIR}/${name}`);
      map.set(url, hrefFor(name));
    } catch (e) {
      log(`WARN: تعذّر تنزيل ${url} (${e.message}) — يبقى الرابط بعيداً`);
    }
  }

  return rewriteTree(content, map);
}
