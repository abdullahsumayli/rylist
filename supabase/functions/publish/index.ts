import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// نشر الموقع: (١) ترجمة تلقائية للحقول الناقصة في الأخبار، ثم (٢) إطلاق بناء Vercel.
//
// الترجمة التلقائية:
//   - تشتغل قبل إطلاق البناء، فينشر الموقع بالمحتوى المكتمل.
//   - تملأ فقط اللغات الفاضية (العنوان/النص) — لا تدوس على شيء مكتوب (بشري أو سابق).
//   - تُحفظ في قاعدة البيانات، فتصير قابلة للتعديل من الأدمن وتُترجم مرة واحدة فقط.
//   - تستخدم سر OPENROUTER_API_KEY نفسه (اختياري: TRANSLATE_MODEL / OPENROUTER_MODEL).
//   - لو المفتاح غير مضبوط أو فشلت الترجمة، تُتخطّى بهدوء والنشر يكمل عادي.
//
// الترجمة لا توقف النشر أبدًا:
//   Edge Function عمرها ١٥٠ ثانية. مقال طويل واحد ممكن يستهلكها كلها، فتموت الدالة
//   قبل ما تطلق بناء Vercel — يعني المقال ينحفظ «منشور» في القاعدة ولا يظهر على الموقع.
//   لذلك: للترجمة ميزانية زمنية صارمة، وكل مقال يُترجَم بالتوازي ويُحفظ لحاله (فالتقدّم
//   الجزئي ما يضيع)، وإطلاق البناء يصير دائمًا بعدها مهما كان الباقي.

const LANG: Record<string, string> = { ar: "Arabic", en: "English", zh: "Chinese" };
const FIELDS = ["title", "body"];        // الحقول المترجَمة (المقتطف يُشتق من النص تلقائيًا)
const MAX_TRANSLATIONS = 24;             // سقف أمان لكل عملية نشر (يمنع التعليق)
const TRANSLATE_BUDGET_MS = 90_000;      // ميزانية مرحلة الترجمة — بعدها ننشر بالمتوفّر
const REQUEST_TIMEOUT_MS = 60_000;       // سقف كل طلب ترجمة على حدة
const ROW_CONCURRENCY = 3;               // كم مقال يُترجَم بالتوازي
const HOOK_TIMEOUT_MS = 15_000;          // سقف طلب إطلاق البناء

type I18n = Record<string, Record<string, string>>;

async function translate(
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
  key: string, model: string, deadline: number, quota: { left: number },
): Promise<{ done: number; pending: number }> {
  const i18n: I18n = row.i18n || {};
  const jobs: Promise<number>[] = [];
  let pending = 0;

  for (const field of FIELDS) {
    const obj = { ...(i18n[field] || {}) };
    i18n[field] = obj;
    for (const tgt of codes) {
      if (typeof obj[tgt] === "string" && obj[tgt].trim()) continue;   // موجود — لا نترجم
      const src = pickSource(obj, tgt, codes);
      if (!src) continue;                                              // لا مصدر — لا شيء نترجمه
      if (quota.left <= 0) { pending++; continue; }                    // تجاوزنا سقف العملية
      quota.left--;
      jobs.push((async () => {
        try {
          obj[tgt] = await translate(obj[src], src, tgt, key, model, deadline);
          return 1;
        } catch (e) {
          console.error("[publish] translate failed", row.id, field, tgt, String(e));
          return 0;                                                    // يُكمَل في النشرة الجاية
        }
      })());
    }
  }

  if (!jobs.length) return { done: 0, pending };
  const done = (await Promise.all(jobs)).reduce((a, b) => a + b, 0);
  if (done > 0) {
    const { error } = await service.from("news").update({ i18n }).eq("id", row.id);
    if (error) console.error("[publish] write-back failed", row.id, error.message);
  }
  return { done, pending: pending + (jobs.length - done) };
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

  const queue = [...((rows || []) as { id: string; i18n: I18n }[])];
  const quota = { left: MAX_TRANSLATIONS };
  let translated = 0, pending = 0;

  const worker = async () => {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      if (Date.now() >= deadline) {                 // نفدت الميزانية — الباقي للنشرة الجاية
        pending += FIELDS.length * codes.length;
        continue;
      }
      const r = await translateRow(service, row, codes, key, model, deadline, quota);
      translated += r.done; pending += r.pending;
    }
  };
  await Promise.all(Array.from({ length: Math.min(ROW_CONCURRENCY, queue.length) }, worker));
  return { translated, pending };
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
