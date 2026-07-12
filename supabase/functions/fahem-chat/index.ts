// fahem-chat — عقل "فاهم"، مستشار rylist العقاري بالمحادثة.
//
// وظيفة edge تشغّل حلقة tool-calling عبر OpenRouter (نفس مزوّد فاهم الأصلي،
// endpoint متوافق مع OpenAI) وترجع للواجهة رسالة + أزرار سريعة + بطاقات مشاريع
// + إشارة إظهار فورم التواصل. مفتاح النموذج يبقى في الخادم. قراءة المشاريع تتم
// بمفتاح service-role لأن جدول projects مقفول بـ RLS للأدمن فقط.
//
// نشر: supabase functions deploy fahem-chat   (verify_jwt مفعّل — الودجت يرسل anon)
// شرط تشغيل الذكاء: ضبط السر OPENROUTER_API_KEY
//   supabase secrets set OPENROUTER_API_KEY=sk-or-...
//   (اختياري: OPENROUTER_MODEL — الافتراضي qwen/qwen3.7-plus · SITE_URL للـ attribution)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_MODEL = "qwen/qwen3.7-plus"; // اختيار المالك؛ يُبدَّل بالسر OPENROUTER_MODEL.
const MAX_TURNS = 40; // سقف طول السجل الوارد (حماية إساءة).
const MAX_CONTENT = 4000; // سقف طول كل رسالة.
const MAX_LOOP = 6; // سقف لفّات الأدوات لكل طلب.

type Lang = "ar" | "en";

// كل المخزون داخل الرياض حاليًا؛ خرائط تسمية خفيفة تكفي (بدل جلب التصنيفات).
const CITY: Record<string, { ar: string; en: string }> = {
  riyadh: { ar: "الرياض", en: "Riyadh" },
};
const TYPE: Record<string, { ar: string; en: string }> = {
  villa: { ar: "فيلا", en: "Villa" },
  apartment: { ar: "شقة", en: "Apartment" },
  townhouse: { ar: "تاون هاوس", en: "Townhouse" },
  land: { ar: "أرض", en: "Land" },
  offplan: { ar: "على الخارطة", en: "Off-plan" },
};
const TYPE_KEYS = Object.keys(TYPE);

function label(map: Record<string, { ar: string; en: string }>, key: string, lang: Lang): string {
  return map[key]?.[lang] || key || "";
}

// الافتتاحية الحتمية (بلا نداء نموذج) — تضمن أزرارًا في الدور الأول.
function opening(lang: Lang): { message: string; quickReplies: string[] } {
  return lang === "en"
    ? { message: "Hi! I'm Fahem, your rylist real-estate advisor. Are you looking to live or to invest?", quickReplies: ["Living", "Investment"] }
    : { message: "هلا والله! أنا فاهم، مستشارك العقاري في rylist. وش ناوي عليه — سكن ولا استثمار؟", quickReplies: ["سكن", "استثمار"] };
}

// رسالة احتياطية لو أخرجت أداة منهِية نصًّا فارغًا (سلوك نموذج شاذ نادر) — نتجنّب فقاعة فارغة.
function fallbackMsg(lang: Lang): string {
  return lang === "en" ? "How can I help you further?" : "كيف أقدر أساعدك أكثر؟";
}

function systemPrompt(lang: Lang): string {
  const uiLang = lang === "ar" ? "Arabic" : "English";
  return `You are "فاهم" (Fahem), a Riyadh real-estate advisor for rylist. Users usually write in ARABIC; understand them and reply in the user's language, short and warm (fallback: ${uiLang}). You have 3 tools:
- present_options(question, options[]): ask ONE guided question with 2-5 tappable answer buttons (in the user's language). Never leave the question or options empty.
- search_inventory(type?, budget_min?, budget_max?, beds_min?): search projects. type is one of: apartment, villa, townhouse, land.
- request_contact(message, project_code?): show a contact form to capture the client's name and phone.
RULES:
1. FIRST extract what the user ALREADY said (purpose: living or investment; property type: apartment/villa/townhouse/land; budget, e.g. "مليون ونص" = 1500000; bedrooms). NEVER re-ask something already given. Understand Arabic (شقة = apartment, للسكن = living, استثمار = investment).
2. As SOON as you know the property TYPE or a BUDGET, CALL search_inventory IMMEDIATELY. Do not ask anything more. If the user asks to search (ابحث / دوّر / search), call it now with whatever you have.
3. Otherwise, ask ONLY the single most useful MISSING question via present_options. City is always Riyadh; never ask it.
4. After search results, describe the matches BY NAME with key specs (area, rooms, price). NEVER invent projects, prices, or details. If none match, say so and suggest changing type or budget.
5. When the user likes a project or asks how to proceed, CALL request_contact (with project_code when known).
Always prefer calling a tool over plain text. rylist is a broker: the client pays ZERO commission (the developer pays); the rylist team — never the developer — contacts and follows up with the client; projects are public, so name them openly.`;
}

// أدوات بصيغة OpenAI (function calling) — كما في فاهم الأصلي.
const tools = [
  {
    type: "function",
    function: {
      name: "present_options",
      description:
        "Ask the user a guided question with tappable answer buttons. Use for questions with clear choices (purpose, property type, budget range, bedrooms). Ask ONE question at a time.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question text, in the user's language." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "2 to 5 short answer options, in the user's language.",
          },
        },
        required: ["question", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_inventory",
      description:
        "Search rylist's residential projects (all inside Riyadh, Saudi Arabia). Call this once you know the property type or a budget. Returns up to 5 matching projects.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: TYPE_KEYS },
          budget_min: { type: "number" },
          budget_max: { type: "number" },
          beds_min: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_contact",
      description:
        "Show a contact form to capture the user's name and phone so the rylist team can reach out. Call after presenting good matches and the user shows interest. Pass project_code of the project the user liked when known.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "A short friendly message inviting the user to leave their contact, in the user's language.",
          },
          project_code: { type: "string", description: "The code of the project the user is interested in, if known." },
        },
        required: ["message"],
      },
    },
  },
];

type SearchArgs = { type?: string; budget_min?: number; budget_max?: number; beds_min?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchInventory(admin: any, args: SearchArgs, lang: Lang) {
  let q = admin
    .from("projects")
    .select("code, city_key, type_key, status, price_min, price_max, beds_min, beds_max, area, image_url, i18n")
    .in("status", ["available", "soon"]); // نستبعد المباع/المحجوز.
  if (args.type) q = q.eq("type_key", args.type);
  if (args.budget_max) q = q.lte("price_min", args.budget_max);
  if (args.budget_min) q = q.gte("price_min", args.budget_min);
  if (args.beds_min) q = q.gte("beds_max", args.beds_min);
  // استبعد المشاريع بلا سعر (مثل "قريبًا" بسعر 0) من أي بحث بميزانية — ما تُعدّ مطابقة.
  if (args.budget_max || args.budget_min) q = q.gt("price_min", 0);
  // المتاح (المسعّر) قبل "قريبًا"، ثم الأرخص أولًا — كي لا يتصدّر مشروعٌ بسعر 0 كل بحث.
  q = q.order("status", { ascending: true }).order("price_min", { ascending: true }).limit(5);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((p: any) => {
    const i18n = p.i18n || {};
    const title = i18n.title?.[lang] || i18n.title?.ar || p.code;
    const district = i18n.district?.[lang] || i18n.district?.ar || "";
    return {
      code: p.code,
      title,
      district,
      city: label(CITY, p.city_key, lang),
      type: label(TYPE, p.type_key, lang),
      type_key: p.type_key,
      price_min: p.price_min,
      price_max: p.price_max,
      beds_min: p.beds_min,
      beds_max: p.beds_max,
      area: p.area,
      image_url: p.image_url,
      status: p.status,
      url: `projects/${p.code}.html`,
    };
  });
}

// غلاف رفيع فوق endpoint المتوافق مع OpenAI في OpenRouter (نفس نمط فاهم).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openrouterChat(key: string, messages: any[]): Promise<any> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": Deno.env.get("SITE_URL") || "https://rylist.sa",
      "X-Title": "Fahem",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENROUTER_MODEL") || DEFAULT_MODEL,
      messages,
      tools,
      tool_choice: "auto",
      // أداة واحدة لكل دور — يمنع دفعات مختلطة متناقضة (سؤال + بحث في آنٍ واحد).
      parallel_tool_calls: false,
      temperature: 0.3, // أقل تذبذبًا في وسائط الأدوات.
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolCall = { id: string; function: { name: string; arguments: string } };

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type",
  };
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let lang: Lang = "ar";
  try {
    const body = await req.json();
    lang = body.language === "en" ? "en" : "ar";
    const genericError =
      lang === "ar"
        ? "عذراً، صار خطأ من عندنا. جرّب مرة ثانية بعد شوي."
        : "Sorry, something went wrong on our side. Please try again.";

    // 1) الافتتاحية الحتمية — بلا نداء نموذج.
    const rawHistory = Array.isArray(body.messages) ? body.messages : [];
    if (body.start && rawHistory.length === 0) return json(opening(lang));

    // 1.5) بحث حتمي موجّه — بلا نداء نموذج. الودجت يجمع المعايير بأزرار ثابتة
    //      (الغرض/النوع/الميزانية) ويرسلها هنا مباشرة. مضمون ومستقل عن الموديل،
    //      ويشتغل حتى لو مفتاح OpenRouter غير مضبوط.
    if (body.search && typeof body.search === "object") {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const props = await searchInventory(admin, body.search as SearchArgs, lang);
      const msg = props.length
        ? lang === "ar"
          ? `أبشر! هذي ${props.length} مشاريع تناسب طلبك في الرياض:`
          : `Here are ${props.length} projects that fit your search in Riyadh:`
        : lang === "ar"
          ? "ما لقيت مشروع مطابق تمامًا لمعاييرك — جرّب نطاق ميزانية أوسع أو نوع ثاني."
          : "I couldn't find an exact match — try a wider budget or a different type.";
      return json({ message: msg, properties: props });
    }

    // 2) تنظيف السجل الوارد وتقييده.
    if (rawHistory.length > MAX_TURNS) return json({ message: genericError });
    const history = rawHistory
      .filter(
        (m: unknown) =>
          !!m &&
          ((m as { role?: string }).role === "user" || (m as { role?: string }).role === "assistant") &&
          typeof (m as { content?: unknown }).content === "string",
      )
      .map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, MAX_CONTENT),
      }));

    const key = Deno.env.get("OPENROUTER_API_KEY");
    if (!key) {
      console.error("[fahem-chat] OPENROUTER_API_KEY not set");
      return json({ message: genericError });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 3) رسائل النموذج: system ثم السجل (صيغة OpenAI — assistant بعد system مقبول).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: "system", content: systemPrompt(lang) }];
    for (const turn of history) messages.push({ role: turn.role, content: turn.content });

    // 4) حلقة الأدوات.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = { message: "" };
    for (let i = 0; i < MAX_LOOP; i++) {
      const data = await openrouterChat(key, messages);
      const msg = data.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = (msg.tool_calls as ToolCall[] | undefined) || [];
      if (toolCalls.length > 0) {
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: toolCalls });
        let terminate = false;

        for (const call of toolCalls) {
          const name = call.function?.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function?.arguments || "{}");
          } catch {
            console.error("[fahem-chat] bad tool arguments for", name);
            args = {};
          }

          if (name === "search_inventory") {
            const props = await searchInventory(admin, args as SearchArgs, lang);
            // آخر بحث يفوز (حتى لو فارغًا) — فالبطاقات تطابق نص النموذج ولا تتناقض معه.
            response.properties = props;
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              name,
              content: JSON.stringify(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                props.map((p: any) => ({
                  code: p.code,
                  title: p.title,
                  district: p.district,
                  type: p.type,
                  price_min: p.price_min,
                  price_max: p.price_max,
                  beds_min: p.beds_min,
                  beds_max: p.beds_max,
                  area: p.area,
                  status: p.status,
                })),
              ),
            });
          } else if (name === "present_options") {
            response.message = (args.question as string) || msg.content || fallbackMsg(lang);
            response.quickReplies = Array.isArray(args.options) ? (args.options as string[]) : [];
            terminate = true;
            break; // أداة منهِية — لا تشغّل بقية أدوات الدفعة.
          } else if (name === "request_contact") {
            response.message = (args.message as string) || msg.content || fallbackMsg(lang);
            response.showContactForm = true;
            if (typeof args.project_code === "string") response.projectCode = args.project_code;
            terminate = true;
            break; // أداة منهِية — لا تشغّل بقية أدوات الدفعة.
          } else {
            messages.push({ role: "tool", tool_call_id: call.id, name, content: "unknown tool" });
          }
        }

        if (terminate) return json(response);
        continue; // دع النموذج يصف نتائج البحث في اللفّة التالية.
      }

      // نص عادي → الجواب النهائي.
      response.message = msg.content || "";
      return json(response);
    }

    // نفدت اللفّات دون نص نهائي — اعرض المطابقات إن وُجدت بدل خطأ زائف.
    if (!response.message) {
      response.message = response.properties?.length
        ? lang === "ar"
          ? "هذي أبرز المشاريع المطابقة. تحب تفاصيل أكثر عن مشروع منها؟"
          : "Here are the top matching projects. Want more details on any of them?"
        : genericError;
    }
    return json(response);
  } catch (e) {
    console.error("[fahem-chat] error:", e);
    return json({
      message:
        lang === "ar"
          ? "عذراً، صار خطأ من عندنا. جرّب مرة ثانية بعد شوي."
          : "Sorry, something went wrong on our side. Please try again.",
    });
  }
});
