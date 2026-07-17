import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// نشر الموقع: (١) ترجمة تلقائية للحقول الناقصة في الأخبار، ثم (٢) إطلاق بناء Vercel.
//
// الترجمة التلقائية:
//   - تشتغل قبل إطلاق البناء، فينشر الموقع بالمحتوى المكتمل.
//   - تملأ فقط اللغات الفاضية (العنوان/النص) — لا تدوس على شيء مكتوب (بشري أو سابق).
//   - تُحفظ في قاعدة البيانات، فتصير قابلة للتعديل من الأدمن وتُترجم مرة واحدة فقط.
//   - تستخدم سر OPENROUTER_API_KEY نفسه (اختياري: TRANSLATE_MODEL / OPENROUTER_MODEL).
//   - لو المفتاح غير مضبوط أو فشلت الترجمة، تُتخطّى بهدوء والنشر يكمل عادي.

const LANG: Record<string, string> = { ar: "Arabic", en: "English", zh: "Chinese" };
const FIELDS = ["title", "body"];        // الحقول المترجَمة (المقتطف يُشتق من النص تلقائيًا)
const MAX_TRANSLATIONS = 24;             // سقف أمان لكل عملية نشر (يمنع التعليق)

async function translate(text: string, src: string, tgt: string, key: string, model: string): Promise<string> {
  const srcName = LANG[src] || src, tgtName = LANG[tgt] || tgt;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
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

// يملأ لغات الأخبار الناقصة عبر الترجمة، ويكتبها في قاعدة البيانات. يُرجع عدد الحقول المترجَمة.
async function autoTranslateNews(): Promise<number> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) return 0;                    // الذكاء غير مضبوط — نتخطّى بهدوء
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const model = Deno.env.get("TRANSLATE_MODEL") || Deno.env.get("OPENROUTER_MODEL") || "qwen/qwen3.7-plus";

  const { data: locs } = await service.from("locales").select("code").eq("enabled", true);
  const codes = (locs || []).map((l: { code: string }) => l.code).filter((c: string) => LANG[c]);
  const { data: rows } = await service.from("news").select("id,i18n").eq("status", "published");

  let translated = 0;
  for (const row of (rows || []) as { id: string; i18n: Record<string, Record<string, string>> }[]) {
    if (translated >= MAX_TRANSLATIONS) break;
    const i18n = row.i18n || {};
    let changed = false;
    for (const field of FIELDS) {
      const obj = (i18n[field] || {}) as Record<string, string>;
      for (const tgt of codes) {
        if (translated >= MAX_TRANSLATIONS) break;
        if (typeof obj[tgt] === "string" && obj[tgt].trim()) continue;   // موجود — لا نترجم
        const src = pickSource(obj, tgt, codes);
        if (!src) continue;                                              // لا مصدر — لا شيء نترجمه
        try {
          obj[tgt] = await translate(obj[src], src, tgt, key, model);
          translated++; changed = true;
        } catch (e) {
          console.error("[publish] translate failed", field, tgt, String(e));
        }
      }
      i18n[field] = obj;
    }
    if (changed) {
      const { error } = await service.from("news").update({ i18n }).eq("id", row.id);
      if (error) console.error("[publish] write-back failed", row.id, error.message);
    }
  }
  return translated;
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

  // ترجمة تلقائية للحقول الناقصة قبل البناء — لا تُفشل النشر أبدًا لو تعثّرت.
  let translated = 0;
  try { translated = await autoTranslateNews(); }
  catch (e) { console.error("[publish] auto-translate skipped:", String(e)); }

  // نتأكد فعليًا أن hook البناء انطلق — وإلا فإن hook معطّل يرجع نجاحًا وهميًا والموقع ما يُبنى.
  let r: Response;
  try {
    r = await fetch(hook, { method: "POST" });
  } catch (e) {
    return json({ error: "deploy hook unreachable", detail: String(e) }, 502);
  }
  const bodyText = await r.text().catch(() => "");
  if (!r.ok) return json({ error: "deploy hook rejected the request", hookStatus: r.status, hookBody: bodyText.slice(0, 300) }, 502);

  let job: { id?: string; state?: string } | undefined;
  try { const p = JSON.parse(bodyText); if (p?.job) job = { id: p.job.id, state: p.job.state }; } catch { /* non-JSON hook response is still a 2xx success */ }
  return json({ ok: true, translated, hookStatus: r.status, job });
});
