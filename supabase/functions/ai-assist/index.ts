import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "claude-opus-4-8";
const LANG = { ar: "العربية", en: "English", zh: "中文 (Chinese)" } as const;
type Loc = keyof typeof LANG;

function ctxLines(c: Record<string, unknown> = {}) {
  const map: Record<string, string> = {
    code: "الكود", city: "المدينة", type: "النوع", status: "الحالة",
    priceMin: "أقل سعر", priceMax: "أعلى سعر", bedsMin: "أقل غرف", bedsMax: "أكثر غرف",
    area: "المساحة", title: "العنوان الحالي", district: "الحي",
  };
  return Object.entries(map)
    .filter(([k]) => c[k] !== undefined && c[k] !== null && c[k] !== "")
    .map(([k, label]) => `- ${label}: ${c[k]}`)
    .join("\n");
}

function buildPrompt(body: any): { system: string; user: string } {
  const loc: Loc = (body.locale in LANG ? body.locale : "ar") as Loc;
  const lang = LANG[loc];
  const text = String(body.text || "").trim();
  const ctx = ctxLines(body.context);
  const brand =
    "أنت كاتب محتوى تسويقي محترف لمكتب RYLIST العقاري في السعودية. نبرتك راقية وواثقة (هوية «ترف صامت»)، دقيقة بلا مبالغة كاذبة، وموجّهة لمشترٍ راقٍ.";

  switch (body.action) {
    case "generate":
      return {
        system: `${brand} تكتب باللغة: ${lang}. أخرِج النص المطلوب فقط، بلا مقدمات ولا علامات اقتباس.`,
        user: `اكتب وصفًا تسويقيًا موجزًا (٣٠–٦٠ كلمة) لهذا العقار باللغة ${lang}:\n${ctx || "(لا بيانات إضافية)"}`,
      };
    case "improve":
      return {
        system: `${brand} حسّن النص مع الحفاظ على لغته (${lang}) ومعناه. أخرِج النص المحسّن فقط.`,
        user: `حسّن هذا النص واجعله أقوى تسويقيًا وأوضح:\n\n${text}`,
      };
    case "seo":
      return {
        system: `${brand} تكتب باللغة: ${lang}. أخرِج عنوانًا واحدًا فقط (سطر واحد)، بلا علامات اقتباس.`,
        user: `اقترح عنوانًا تسويقيًا قصيرًا محسّنًا لمحركات البحث (SEO) باللغة ${lang} لهذا العقار:\n${ctx}\n${text ? `العنوان الحالي: ${text}` : ""}`,
      };
    case "ideas":
      return {
        system: `${brand} أخرِج ٣–٥ نقاط بيع مختصرة باللغة ${lang}، كل نقطة في سطر يبدأ بـ«•»، بلا مقدمة.`,
        user: `اقترح أبرز نقاط البيع لهذا العقار:\n${ctx || text}`,
      };
    default:
      return { system: brand, user: text };
  }
}

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Anthropic ${resp.status}`);
  }
  if (data?.stop_reason === "refusal") throw new Error("رفض النموذج توليد هذا المحتوى.");
  const text = (data?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  if (!text) throw new Error("رجعت استجابة فارغة من النموذج.");
  return text;
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type",
  };
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: isAdmin } = await sb.rpc("is_admin");
    if (isAdmin !== true) return json({ error: "unauthorized" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "لم يُضبَط مفتاح ANTHROPIC_API_KEY في Supabase بعد." }, 500);

    const body = await req.json();

    // translate: one call per target locale, in parallel
    if (body.action === "translate") {
      const src = String(body.text || "").trim();
      if (!src) return json({ error: "لا يوجد نص للترجمة." }, 400);
      const targets: Loc[] = (body.targetLocales || []).filter((l: string) => l in LANG && l !== body.locale);
      const entries = await Promise.all(
        targets.map(async (loc) => {
          const t = await callClaude(
            apiKey,
            `أنت مترجم تسويقي محترف. ترجم إلى ${LANG[loc]} بأسلوب طبيعي (لا حرفي). أخرِج الترجمة فقط.`,
            src,
          );
          return [loc, t] as const;
        }),
      );
      return json({ translations: Object.fromEntries(entries) });
    }

    const { system, user } = buildPrompt(body);
    const result = await callClaude(apiKey, system, user);
    return json({ result });
  } catch (e) {
    return json({ error: (e as Error).message || "خطأ غير متوقع" }, 502);
  }
});
