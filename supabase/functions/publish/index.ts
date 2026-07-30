import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chunkForTranslation } from "./chunk.mjs";

// نشر الموقع: (١) ترجمة تلقائية للحقول الناقصة في الأخبار، ثم (٢) إطلاق بناء Vercel.
// ولها إجراء ثانٍ: {action:"translate", id} — ترجمة مقال واحد عند الطلب من المحرّر،
// قبل النشر، حتى يراجع صاحب الموقع المقال بالثلاث لغات قبل أن يخرج للناس.
//
// الترجمة التلقائية (عند نشر الموقع) شبكة أمان لما فات، والبوابة الحقيقية في المحرّر.
//   - تشتغل قبل إطلاق البناء، فينشر الموقع بالمحتوى المكتمل.
//   - تملأ فقط اللغات الفاضية (العنوان/النص) — لا تدوس على شيء مكتوب (بشري أو سابق).
//   - تُحفظ في قاعدة البيانات، فتصير قابلة للتعديل من الأدمن وتُترجم مرة واحدة فقط.
//   - تستخدم سر OPENROUTER_API_KEY نفسه (اختياري: TRANSLATE_MODEL / OPENROUTER_MODEL).
//   - لو المفتاح غير مضبوط أو فشلت الترجمة، تُتخطّى بهدوء والنشر يكمل عادي.
//
// الترجمة لا توقف النشر أبدًا:
//   Edge Function عمرها ١٥٠ ثانية. فللترجمة ميزانية زمنية صارمة، وإطلاق البناء
//   يصير دائمًا بعدها مهما كان الباقي — وإلا انحفظ المقال «منشورًا» ولا ظهر أبدًا.
//
// النص يُترجَم على قطع:
//   نص المقال يوصل ١٠ آلاف حرف؛ ترجمته بطلب واحد تتجاوز الدقيقة فتُلغى، وهذا اللي
//   خلّى العناوين تُترجَم والنصوص لا. الحل: قطع ≤١٨٠٠ حرف تُترجَم بالتوازي ثم تُلصق.
//   القطع تنتهي عند حدود عناصر HTML العليا فقط (انظر chunk.mjs)، وحقل النص كله
//   إما ينجح كاملًا أو يُترك للنشرة الجاية — لا نكتب نصًا نصفه عربي ونصفه مترجم.

const LANG: Record<string, string> = { ar: "Arabic", en: "English", zh: "Chinese" };
// كل حقل نصي يظهر للزائر يجب أن يُترجَم. المقتطف والتصنيف يُعرضان فوق العنوان
// مباشرة في صفحة المقال وفي بطاقات المدونة، وكانا يسقطان للعربي في الصفحات
// الإنجليزية والصينية لأنهما لم يكونا في هذه القائمة — فقرة عربية تحت عنوان إنجليزي.
const FIELDS = ["title", "body", "excerpt", "category"];
const CHUNK_CHARS = 1800;                // سقف طول القطعة الواحدة
const MAX_CONCURRENT = 8;                // طلبات الترجمة المتزامنة
const MAX_REQUESTS = 90;                 // سقف أمان لعدد الطلبات في النشرة الواحدة
const TRANSLATE_BUDGET_MS = 105_000;     // ميزانية مرحلة الترجمة — بعدها ننشر بالمتوفّر
const ONE_BUDGET_MS = 130_000;           // ميزانية ترجمة مقال واحد (لا بناء بعدها، فالسقف أوسع)
const REQUEST_TIMEOUT_MS = 45_000;       // سقف كل طلب ترجمة على حدة
const HOOK_TIMEOUT_MS = 15_000;          // سقف طلب إطلاق البناء

type I18n = Record<string, Record<string, string>>;

// منظّم تزامن بسيط: يشغّل MAX_CONCURRENT طلبًا كحد أقصى في اللحظة الواحدة.
function makeLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const release = () => { active--; queue.shift()?.(); };
  return async <T>(run: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active++;
    try { return await run(); } finally { release(); }
  };
}

async function translateChunk(
  text: string, src: string, tgt: string, key: string, model: string, deadline: number,
): Promise<string> {
  const srcName = LANG[src] || src, tgtName = LANG[tgt] || tgt;
  const budget = Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now());
  if (budget <= 0) throw new Error("out of time budget");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(budget),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": Deno.env.get("SITE_URL") || "https://rylist.sa",
      "X-Title": "RYLIST Translate",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content:
          `You are a professional translator for a Saudi real-estate company's website. `
          + `Translate the user's text from ${srcName} to ${tgtName}. `
          + `The text may be an HTML fragment taken from the middle of a longer article: keep every `
          + `HTML tag, attribute and URL byte-for-byte as given, and translate only the human-readable `
          + `text between tags. Do not add, remove or reorder markup, and never wrap the output in code fences. `
          + `Preserve the exact paragraph and line-break structure. Translate Saudi place and project `
          + `names naturally and keep numbers and years. Do not add, remove, explain, or comment — `
          + `output ONLY the translated text.` },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("empty translation");
  return out;
}

// يترجم حقلًا كاملًا (عنوان أو نص) على قطع متوازية. كله أو لا شيء.
async function translateField(
  text: string, src: string, tgt: string, key: string, model: string,
  deadline: number, limit: ReturnType<typeof makeLimiter>, budget: { requests: number },
): Promise<string> {
  const chunks = chunkForTranslation(text, CHUNK_CHARS);
  if (!chunks.length) throw new Error("nothing to translate");
  if (budget.requests < chunks.length) throw new Error("request budget exhausted");
  budget.requests -= chunks.length;

  const out = await Promise.all(chunks.map((c: string) => limit(async () => {
    try {
      return await translateChunk(c, src, tgt, key, model, deadline);
    } catch (e) {
      if (Date.now() >= deadline) throw e;          // ما بقي وقت لإعادة المحاولة
      return await translateChunk(c, src, tgt, key, model, deadline);   // محاولة ثانية
    }
  })));
  return out.join("");
}

// يختار لغة مصدر فيها محتوى لهذا الحقل (يفضّل العربي ثم الإنجليزي).
function pickSource(field: Record<string, unknown>, tgt: string, codes: string[]): string | null {
  for (const s of ["ar", "en", ...codes]) {
    if (s !== tgt && typeof field[s] === "string" && (field[s] as string).trim()) return s;
  }
  return null;
}

// يترجم مقالًا واحدًا: كل حقوله الناقصة بالتوازي، ثم كتابة واحدة للقاعدة.
// كل مقال يُكتب لحاله — فما فيه تسابق على i18n بين المقالات، والتقدّم الجزئي محفوظ.
async function translateRow(
  // deno-lint-ignore no-explicit-any
  service: any, row: { id: string; i18n: I18n }, codes: string[],
  key: string, model: string, deadline: number,
  limit: ReturnType<typeof makeLimiter>, budget: { requests: number },
): Promise<{ done: number; pending: number }> {
  const i18n: I18n = row.i18n || {};
  const jobs: Promise<number>[] = [];

  for (const field of FIELDS) {
    const obj = { ...(i18n[field] || {}) };
    i18n[field] = obj;
    for (const tgt of codes) {
      if (typeof obj[tgt] === "string" && obj[tgt].trim()) continue;   // موجود — لا نترجم
      const src = pickSource(obj, tgt, codes);
      if (!src) continue;                                              // لا مصدر — لا شيء نترجمه
      jobs.push((async () => {
        try {
          obj[tgt] = await translateField(obj[src], src, tgt, key, model, deadline, limit, budget);
          return 1;
        } catch (e) {
          console.error("[publish] translate failed", row.id, field, tgt, String(e));
          return 0;                                                    // يُكمَل في النشرة الجاية
        }
      })());
    }
  }

  if (!jobs.length) return { done: 0, pending: 0 };
  const done = (await Promise.all(jobs)).reduce((a, b) => a + b, 0);
  if (done > 0) {
    const { error } = await service.from("news").update({ i18n }).eq("id", row.id);
    if (error) console.error("[publish] write-back failed", row.id, error.message);
  }
  return { done, pending: jobs.length - done };
}

// اللغات المطلوبة قبل النشر، والحقول التي يجب أن تكتمل في كلٍّ منها.
function missingLocales(i18n: I18n, codes: string[]): string[] {
  return codes.filter((c) =>
    FIELDS.some((f) => !String((i18n?.[f] || {})[c] || "").trim())
  );
}

// ترجمة مقال واحد بعينه (أي حالة: مسودة أو منشور) — يستدعيها محرّر الأدمن قبل النشر
// حتى يراجع صاحب الموقع المقال بالثلاث لغات قبل أن يخرج للناس.
async function translateOne(id: string): Promise<
  { ok: true; i18n: I18n; translated: number; pending: number; missing: string[] } | { ok: false; error: string }
> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY غير مضبوط" };
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const model = Deno.env.get("TRANSLATE_MODEL") || Deno.env.get("OPENROUTER_MODEL") || "qwen/qwen3.7-plus";

  const { data: locs } = await service.from("locales").select("code").eq("enabled", true);
  const codes = (locs || []).map((l: { code: string }) => l.code).filter((c: string) => LANG[c]);
  const { data: row, error } = await service.from("news").select("id,i18n").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "المقال غير موجود" };

  const deadline = Date.now() + ONE_BUDGET_MS;
  const limit = makeLimiter(MAX_CONCURRENT);
  const budget = { requests: MAX_REQUESTS };
  const r = await translateRow(service, row as { id: string; i18n: I18n }, codes, key, model, deadline, limit, budget);

  // نعيد قراءة الصف بعد الكتابة حتى يستلم المحرّر النص كما استقر فعلًا في القاعدة.
  const { data: fresh } = await service.from("news").select("i18n").eq("id", id).maybeSingle();
  const i18n = (fresh?.i18n || {}) as I18n;
  return { ok: true, i18n, translated: r.done, pending: r.pending, missing: missingLocales(i18n, codes) };
}

// يملأ لغات الأخبار الناقصة عبر الترجمة، ويكتبها في قاعدة البيانات، ضمن ميزانية زمنية.
async function autoTranslateNews(): Promise<{ translated: number; pending: number }> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return { translated: 0, pending: 0 };   // الذكاء غير مضبوط — نتخطّى بهدوء
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const model = Deno.env.get("TRANSLATE_MODEL") || Deno.env.get("OPENROUTER_MODEL") || "qwen/qwen3.7-plus";
  const deadline = Date.now() + TRANSLATE_BUDGET_MS;

  const { data: locs } = await service.from("locales").select("code").eq("enabled", true);
  const codes = (locs || []).map((l: { code: string }) => l.code).filter((c: string) => LANG[c]);
  const { data: rows } = await service.from("news").select("id,i18n").eq("status", "published");

  // القطع تتزاحم على منظّم تزامن واحد، فالمقالات كلها تُعالَج معًا بلا إغراق للمزوّد.
  const limit = makeLimiter(MAX_CONCURRENT);
  const budget = { requests: MAX_REQUESTS };
  const results = await Promise.all(
    ((rows || []) as { id: string; i18n: I18n }[])
      .map((row) => translateRow(service, row, codes, key, model, deadline, limit, budget)),
  );
  return {
    translated: results.reduce((a, r) => a + r.done, 0),
    pending: results.reduce((a, r) => a + r.pending, 0),
  };
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type",
  };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "unauthorized" }, 401);

  // ترجمة مقال واحد عند الطلب من المحرّر — تُستدعى قبل النشر، ولا تبني الموقع.
  let payload: { action?: string; id?: string } = {};
  try { payload = await req.json(); } catch { /* لا جسم للطلب = نشر الموقع كالعادة */ }
  if (payload?.action === "translate") {
    if (!payload.id) return json({ error: "id مطلوب" }, 400);
    const r = await translateOne(payload.id);
    return r.ok ? json(r) : json({ error: r.error }, 500);
  }

  const hook = Deno.env.get("VERCEL_DEPLOY_HOOK");
  if (!hook) return json({ error: "deploy hook not set" }, 500);

  // ترجمة تلقائية للحقول الناقصة قبل البناء — محدودة بميزانية، ولا تُفشل النشر أبدًا.
  let translated = 0, pendingTranslations = 0;
  try {
    const r = await autoTranslateNews();
    translated = r.translated; pendingTranslations = r.pending;
  } catch (e) { console.error("[publish] auto-translate skipped:", String(e)); }

  // نتأكد فعليًا أن hook البناء انطلق — وإلا فإن hook معطّل يرجع نجاحًا وهميًا والموقع ما يُبنى.
  let r: Response;
  try {
    r = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(HOOK_TIMEOUT_MS) });
  } catch (e) {
    return json({ error: "deploy hook unreachable", detail: String(e) }, 502);
  }
  const bodyText = await r.text().catch(() => "");
  if (!r.ok) return json({ error: "deploy hook rejected the request", hookStatus: r.status, hookBody: bodyText.slice(0, 300) }, 502);

  let job: { id?: string; state?: string } | undefined;
  try { const p = JSON.parse(bodyText); if (p?.job) job = { id: p.job.id, state: p.job.state }; } catch { /* non-JSON hook response is still a 2xx success */ }
  return json({ ok: true, translated, pendingTranslations, hookStatus: r.status, job });
});
