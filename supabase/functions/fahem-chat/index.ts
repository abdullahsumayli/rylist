// fahem-chat — عقل "فاهم"، مستشار rylist العقاري بالمحادثة.
//
// تدفّق مبسّط: المدن والأنواع المتوفرة تُشتق من المخزون (جدول projects) — فاهم
// يذكر المدن المخدومة بدل ما يسأل عنها، يسأل العميل سؤالًا مفتوحًا عن العقار،
// يبحث، ويرد بصدق بما هو متوفر فقط (بلا اختراع). المخزون يُحقن في برومبت الموديل.
//
// نشر: supabase functions deploy fahem-chat   (verify_jwt مفعّل — الودجت يرسل anon)
// شرط الذكاء: ضبط السر OPENROUTER_API_KEY
//   (اختياري: OPENROUTER_MODEL — الافتراضي qwen/qwen3.7-plus · SITE_URL للـ attribution)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { faqBlock, fewShot } from "./knowledge.ts";

const DEFAULT_MODEL = "qwen/qwen3.7-plus"; // يُبدّل بالسر OPENROUTER_MODEL.
const MAX_TURNS = 40; // سقف طول السجل الوارد (حماية إساءة).
const MAX_CONTENT = 4000; // سقف طول كل رسالة.
const MAX_LOOP = 6; // سقف لفّات الأدوات لكل طلب.

type Lang = "ar" | "en";

// خرائط تسمية خفيفة (المفاتيح كما في الجدول → عربي/إنجليزي).
const CITY: Record<string, { ar: string; en: string }> = {
  riyadh: { ar: "الرياض", en: "Riyadh" },
  jeddah: { ar: "جدة", en: "Jeddah" },
  dammam: { ar: "الدمام", en: "Dammam" },
  makkah: { ar: "مكة", en: "Makkah" },
  madinah: { ar: "المدينة", en: "Madinah" },
};
const TYPE: Record<string, { ar: string; en: string }> = {
  villa: { ar: "فيلا", en: "Villa" },
  apartment: { ar: "شقة", en: "Apartment" },
  townhouse: { ar: "تاون هاوس", en: "Townhouse" },
  land: { ar: "أرض", en: "Land" },
  offplan: { ar: "على الخارطة", en: "Off-plan" },
};
// الأنواع الصالحة للبحث (offplan حالة لا نوع سكني — يُستبعد من enum الأداة).
const SEARCH_TYPES = ["apartment", "villa", "townhouse", "land"];

function label(map: Record<string, { ar: string; en: string }>, key: string, lang: Lang): string {
  return map[key]?.[lang] || key || "";
}

// صياغة قائمة طبيعية: ["الرياض","جدة"] → "الرياض وجدة".
function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items[0] || "";
  const sep = lang === "ar" ? "، " : ", ";
  const and = lang === "ar" ? " و" : " and ";
  return items.slice(0, -1).join(sep) + and + items[items.length - 1];
}

type Facts = { cityKeys: string[]; typeKeys: string[]; cities: string[]; types: string[] };

// حقائق المخزون الحيّة: أي مدن وأي أنواع موجودة فعلًا (المتاح + القريب).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function inventoryFacts(admin: any, lang: Lang): Promise<Facts> {
  const { data } = await admin.from("projects").select("city_key, type_key, status").in("status", ["available", "soon"]);
  const rows = data || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cityKeys = [...new Set(rows.map((r: any) => r.city_key).filter(Boolean))] as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typeKeys = [...new Set(rows.map((r: any) => r.type_key).filter(Boolean))] as string[];
  return {
    cityKeys,
    typeKeys,
    cities: cityKeys.map((k) => label(CITY, k, lang)),
    types: typeKeys.map((k) => label(TYPE, k, lang)),
  };
}

// استخراج حتمي لنوع العقار من نص العميل (بلا نموذج) — مضمون، أهم من ذكاء الموديل.
const TYPE_HINTS: { key: string; re: RegExp }[] = [
  { key: "townhouse", re: /تاون\s*هاوس|تاونهاوس|town\s*house|townhouse/i },
  { key: "offplan", re: /على\s*الخارطة|أوف\s*بلان|off.?plan|تحت\s*الإنشاء/i },
  { key: "apartment", re: /شق[ةق]|apartment|flat/i },
  { key: "villa", re: /فيلا|فلل|فله|villa/i },
  { key: "land", re: /أرض|ارض|أراضي|اراضي|قطعة\s*أرض|\bland\b|plot/i },
];
function detectType(text: string): string | undefined {
  for (const h of TYPE_HINTS) if (h.re.test(text)) return h.key;
  return undefined;
}

// استخراج ميزانية تقريبية (budget_max) — محافظ: عند الشك لا يُرجع شيئًا.
function detectBudget(text: string): { budget_max?: number } {
  const t = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (/مليونين/.test(t)) return { budget_max: 2000000 };
  if (/مليون\s*و?\s*(نص|نصف)/.test(t)) return { budget_max: 1500000 };
  if (/مليون/.test(t)) return { budget_max: 1000000 };
  const alf = t.match(/(\d{2,4})\s*(ألف|الف|k)/i);
  if (alf) return { budget_max: parseInt(alf[1], 10) * 1000 };
  const big = t.match(/(\d{6,})/);
  if (big) return { budget_max: parseInt(big[1], 10) };
  return {};
}

// كود مشروع صريح (NAJD-2 / نجد ٢) — للبحث بالاسم/الكود مباشرة (يعالج استرجاع نجد ٢).
function detectProjectCode(text: string): string | undefined {
  const t = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const m = t.match(/(?:najd|نجد)\s*[-]?\s*([1-9])\b/i);
  return m ? `NAJD-${m[1]}` : undefined;
}

// التقاط اسم/جوال مكتوب داخل الشات (حجز إنلاين بلا ودجت). الجوال السعودي: 05xxxxxxxx أو +9665…
function detectContact(text: string): { phone?: string; name?: string } {
  const norm = text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const digits = norm.replace(/[\s\-()]/g, "");
  const pm = digits.match(/(?:(?:\+?966|00966)5\d{8})|(?:05\d{8})/);
  const phone = pm ? pm[0] : undefined;
  let name: string | undefined;
  const nm = text.match(/(?:اسمي|أنا|انا|name is|i am|i'm)\s+([^\d\n,،.]{2,30}?)(?:\s*(?:،|,|\.|و?جوال|و?رقم|رقمي|my|phone|\d)|$)/i);
  if (nm) name = nm[1].trim().replace(/\s+/g, " ");
  return { phone, name };
}

// الافتتاحية الحتمية — تذكر المدن المخدومة (من المخزون) ثم سؤال مفتوح. بلا نداء نموذج.
function opening(lang: Lang, facts: Facts): { message: string } {
  const cities = joinList(facts.cities, lang) || (lang === "ar" ? "الرياض" : "Riyadh");
  return lang === "en"
    ? { message: `Hi! I'm Fahem, your rylist real-estate advisor. Right now we serve properties in ${cities}. What kind of property are you looking for?` }
    : { message: `هلا والله! أنا فاهم، مستشارك العقاري في rylist. حاليًا نخدمك في عقارات داخل ${cities}. وش نوع العقار اللي تدوّر عليه؟` };
}

// رسالة احتياطية لو أخرجت أداة منهِية نصًا فارغًا.
function fallbackMsg(lang: Lang): string {
  return lang === "en" ? "How can I help you further?" : "كيف أقدر أساعدك أكثر؟";
}

function systemPrompt(lang: Lang, facts: Facts): string {
  const uiLang = lang === "ar" ? "Arabic" : "English";
  const cities = joinList(facts.cities, lang) || (lang === "ar" ? "الرياض" : "Riyadh");
  const types = facts.types.length ? joinList(facts.types, lang) : lang === "ar" ? "لا شيء حاليًا" : "none right now";
  return `You are "فاهم" (Fahem), a warm Riyadh real-estate advisor for rylist. Users almost always write ARABIC (Gulf dialect included). Reply in their language (fallback: ${uiLang}), warm and concise. You are an ADVISOR who converses and gives reasoned advice grounded ONLY in tool facts — reply in plain text; use a tool only to search inventory, to offer a genuine either/or choice, or to capture contact when the user is truly ready.

INVENTORY YOU HAVE — this is the ONLY stock that exists. Never invent anything beyond it:
- Cities served: ${cities}. rylist has properties ONLY in these. NEVER ask the user which city, and never claim stock in any city outside this list.
- Property types in stock right now: ${types}.

TOOLS:
- search_inventory(type?, budget_min?, budget_max?, beds_min?): search the projects. type is one of: apartment, villa, townhouse, land.
- present_options(question, options[]): ask ONE short question with 2-5 tappable options. Never leave either empty.
- request_contact(message, project_code?): show a form to capture the client's name and phone.

HOW TO ACT — top to bottom, every turn:
1. Extract what the user ALREADY said (type, budget, district) and NEVER re-ask it. Arabic cues:
   شقة=apartment · فيلا=villa · تاون هاوس/تاونهاوس=townhouse · أرض=land ·
   budgets: مليون=1000000 · "مليون ونص"/"مليون ونصف"=1500000 · "٨٠٠ ألف"=800000 · مليونين=2000000.
2. Whenever the user names a property TYPE or a BUDGET → ALWAYS call search_inventory immediately with what you have — even for a type you suspect we don't stock (the tool confirms it and, if empty, tells you the types actually in stock). Do not ask anything else first.
3. NEVER claim we have a type, city, or project that the tool did not return. If the search comes back empty, say plainly we don't have it and offer the in-stock types (${types}).
4. Describe matches BY NAME with area/rooms/price from the tool output ONLY. NEVER invent a project, price, district, or detail.
5. Use request_contact ONLY when the user shows real buying intent or asks to proceed / visit / be contacted — NEVER as a way to dodge a question you can answer. Pass project_code when known.
6. When asked to compare or "which is better and why", give real reasoning FROM the tool facts (space, price, rooms, district trade-offs) — advise, don't just re-list cards. Never re-ask something the user already said.

rylist is a broker: the client pays ZERO commission (the developer pays); the rylist team — never the developer — contacts and follows up; projects are public, so name them openly.

${faqBlock(lang)}`;
}

// أدوات بصيغة OpenAI (function calling).
const tools = [
  {
    type: "function",
    function: {
      name: "search_inventory",
      description:
        "Search rylist's projects. Call this as soon as you know the property type or a budget. Returns up to 5 matches; if it returns none, it also lists the types actually in stock.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: SEARCH_TYPES },
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
      name: "present_options",
      description: "Ask the user ONE guided question with tappable answer buttons. Ask one question at a time.",
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
      name: "request_contact",
      description:
        "Show a contact form to capture the user's name and phone so the rylist team can reach out. Call after presenting good matches and the user shows interest. Pass project_code when known.",
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

type SearchArgs = { type?: string; budget_min?: number; budget_max?: number; beds_min?: number; code?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchInventory(admin: any, args: SearchArgs, lang: Lang) {
  let q = admin
    .from("projects")
    .select("code, city_key, type_key, status, price_min, price_max, beds_min, beds_max, area, image_url, i18n")
    .in("status", ["available", "soon"]);
  if (args.code) q = q.eq("code", args.code);
  if (args.type) q = q.eq("type_key", args.type);
  if (args.budget_max) q = q.lte("price_min", args.budget_max);
  if (args.budget_min) q = q.gte("price_min", args.budget_min);
  if (args.beds_min) q = q.gte("beds_max", args.beds_min);
  if (args.budget_max || args.budget_min) q = q.gt("price_min", 0);
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

// غلاف رفيع فوق endpoint المتوافق مع OpenAI في OpenRouter.
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
      parallel_tool_calls: false,
      temperature: 0.2,
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) الافتتاحية الحتمية — تذكر المدن المخدومة (من المخزون). بلا نداء نموذج.
    const rawHistory = Array.isArray(body.messages) ? body.messages : [];
    if (body.start && rawHistory.length === 0) {
      const facts = await inventoryFacts(admin, lang);
      return json(opening(lang, facts));
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

    // 3) حقائق المخزون تُحقن في البرومبت وتغني نتيجة البحث الفارغة (صدق بلا اختراع).
    const facts = await inventoryFacts(admin, lang);
    const cityStr = joinList(facts.cities, lang) || (lang === "ar" ? "الرياض" : "Riyadh");
    const foundMsg = (n: number) =>
      lang === "ar"
        ? n === 1
          ? `أبشر! لقيت لك مشروعًا يناسب طلبك في ${cityStr}:`
          : `أبشر! هذي ${n} مشاريع تناسب طلبك في ${cityStr}:`
        : `Here ${n > 1 ? "are" : "is"} ${n} matching project${n > 1 ? "s" : ""} in ${cityStr}:`;
    const noMatchMsg =
      lang === "ar"
        ? "ما لقيت مطابق تمامًا لطلبك — جرّب نطاق ميزانية أوسع أو نوع ثاني."
        : "I couldn't find an exact match — try a wider budget or a different type.";

    const lastUser =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [...history].reverse().find((m: any) => m.role === "user")?.content || "";

    // 3.1) التقاط اسم/جوال مكتوب داخل الشات (حجز إنلاين بلا ودجت) — حتمي وأولوية.
    const contact = detectContact(lastUser);
    if (contact.phone) {
      try {
        await admin.from("leads").insert({
          name: contact.name || (lang === "ar" ? "عميل من المحادثة" : "Chat lead"),
          phone: contact.phone,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message: [...history].filter((m: any) => m.role === "user").map((m: any) => m.content).join(" | ").slice(0, 1000),
          source: "chat",
          locale: lang,
        });
      } catch (e) {
        console.error("[fahem-chat] inline lead insert failed:", e);
      }
      const who = contact.name ? ` يا ${contact.name}` : "";
      return json({
        message:
          lang === "ar"
            ? `تم${who}! سجّلنا طلبك وفريق rylist بيتواصل معك قريب على ${contact.phone}. تحب تعطيني تفاصيل أكثر عن العقار اللي يهمك؟`
            : `Done${contact.name ? `, ${contact.name}` : ""}! We saved your request and the rylist team will reach out soon on ${contact.phone}. Want to tell me more about what you're looking for?`,
      });
    }

    // 3.5) مسار حتمي: نكتشف الكود/النوع/الميزانية ونبحث مسبقًا، لكن بدل الإرجاع نحقن الحقائق
    //      للموديل ليحاور ويعلّل (هجين). fallback = رد حتمي صادق لو الذكاء واقف.
    const code = detectProjectCode(lastUser);
    const detType = detectType(lastUser);
    const budget = detectBudget(lastUser);
    let prefetchNote = ""; // سياق حقائق للموديل (تعليمات، ليست للعميل)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let prefetchProps: any[] | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallback: Record<string, any> | null = null;
    const inStock = joinList(facts.types, lang);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const compact = (ps: any[]) =>
      ps.map((p) => ({
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
      }));

    if (code) {
      const props = await searchInventory(admin, { code }, lang);
      if (props.length) {
        prefetchProps = props;
        prefetchNote = `CONTEXT: The user referenced project ${code}. The inventory tool returned it (already shown as a card): ${JSON.stringify(compact(props))}. Advise conversationally using ONLY these facts. Do not search again unless criteria change.`;
        fallback = { message: foundMsg(props.length), properties: props };
      } else {
        prefetchNote = `CONTEXT: The user referenced project ${code}, which is not available. In-stock types: ${inStock}. Be honest about that, then offer what exists.`;
        fallback = { message: noMatchMsg };
      }
    } else if (detType && !facts.typeKeys.includes(detType)) {
      const notAvail = label(TYPE, detType, lang);
      prefetchNote = `CONTEXT: The user asked for "${notAvail}", which is NOT in stock. In-stock types: ${inStock}. Say this honestly in one sentence, then advise on the alternatives conversationally.`;
      fallback = {
        message:
          lang === "ar"
            ? `للأسف ما عندنا ${notAvail} حاليًا في ${cityStr}. المتوفر عندنا: ${inStock}. تحب أعرض لك المتوفر؟`
            : `Sorry, we don't have ${notAvail} right now in ${cityStr}. What we do have: ${inStock}. Want me to show it?`,
        quickReplies: facts.types.slice(0, 5),
      };
    } else if (detType) {
      let props = await searchInventory(admin, { type: detType, ...budget }, lang);
      if (!props.length && budget.budget_max) props = await searchInventory(admin, { type: detType }, lang);
      prefetchProps = props;
      prefetchNote = props.length
        ? `CONTEXT: The inventory tool ran for the user's stated criteria and returned these real projects (already shown as cards): ${JSON.stringify(compact(props))}. Describe, compare and recommend using ONLY these facts. Do not search again unless criteria change.`
        : `CONTEXT: No project matched the user's criteria. In-stock types: ${inStock}. Be honest about the gap and suggest adjusting the criteria.`;
      fallback = { message: props.length ? foundMsg(props.length) : noMatchMsg, properties: props };
    } else if (budget.budget_max) {
      const props = await searchInventory(admin, budget, lang);
      prefetchProps = props;
      prefetchNote = props.length
        ? `CONTEXT: The inventory tool ran for the user's budget and returned these real projects (already shown as cards): ${JSON.stringify(compact(props))}. Advise using ONLY these facts. Do not search again unless criteria change.`
        : `CONTEXT: Nothing matched the user's budget. In-stock types: ${inStock}. Be honest and suggest adjusting the budget.`;
      fallback = { message: props.length ? foundMsg(props.length) : noMatchMsg, properties: props };
    }

    // 4) الموديل يقود الحوار. مفتاح الذكاء مطلوب هنا فقط؛ لو غائب/فشل نرجع الرد الحتمي.
    const key = Deno.env.get("OPENROUTER_API_KEY");
    if (!key) {
      console.error("[fahem-chat] OPENROUTER_API_KEY not set");
      return json(fallback || { message: genericError });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: "system", content: systemPrompt(lang, facts) }];
    // أمثلة few-shot مقطَّرة من محادثات حقيقية (تثبيت الصدق والنبرة والتعليل) قبل سجل العميل.
    for (const ex of fewShot(lang)) messages.push({ role: ex.role, content: ex.content });
    for (const turn of history) messages.push({ role: turn.role, content: turn.content });
    // حقائق البحث المسبق تُحقن كتعليمات سياق (الموديل يحاور بناءً عليها بدل بحث جديد).
    if (prefetchNote) messages.push({ role: "system", content: prefetchNote });

    // 4) حلقة الأدوات — لو فشل الذكاء نرجع fallback الحتمي بدل خطأ عام.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = prefetchProps ? { message: "", properties: prefetchProps } : { message: "" };
    try {
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
            // نوع مطلوب غير موجود بالمخزون → رد حتمي صادق (لا نترك الموديل يخترع أو يتخبّط).
            const reqType = typeof args.type === "string" ? args.type : undefined;
            if (reqType && facts.typeKeys.length && !facts.typeKeys.includes(reqType)) {
              const notAvail = label(TYPE, reqType, lang);
              const have = joinList(facts.types, lang);
              const cityStr = joinList(facts.cities, lang) || (lang === "ar" ? "الرياض" : "Riyadh");
              response.message =
                lang === "ar"
                  ? `للأسف ما عندنا ${notAvail} حاليًا في ${cityStr}. المتوفر عندنا: ${have}. تحب أعرض لك المتوفر؟`
                  : `Sorry, we don't have ${notAvail} right now in ${cityStr}. What we do have: ${have}. Want me to show it?`;
              response.quickReplies = facts.types.slice(0, 5);
              return json(response);
            }
            const props = await searchInventory(admin, args as SearchArgs, lang);
            // آخر بحث يفوز (حتى لو فارغًا) — فالبطاقات تطابق نص النموذج.
            response.properties = props;
            // النتيجة الفارغة تُرجع الأنواع المتوفرة كي يرد الموديل بصدق ("ما عندنا فلل، عندنا شقق…").
            const toolContent = props.length
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                }))
              : { results: [], available_types: facts.types, available_cities: facts.cities };
            messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(toolContent) });
          } else if (name === "present_options") {
            response.message = (args.question as string) || msg.content || fallbackMsg(lang);
            // حارس: أسقط أي خيار بنوع غير متوفر (فيلا/أرض…) كي لا نوهم بتوفره.
            const outLabels = new Set(
              Object.keys(TYPE)
                .filter((k) => !facts.typeKeys.includes(k))
                .flatMap((k) => [TYPE[k].ar, TYPE[k].en]),
            );
            const rawOpts = Array.isArray(args.options) ? (args.options as string[]) : [];
            const kept = rawOpts.filter((o) => !outLabels.has(String(o).trim()));
            response.quickReplies = kept.length >= 2 ? kept : rawOpts;
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
    } catch (modelErr) {
      // الذكاء فشل (OpenRouter/شبكة) → رجّع الرد الحتمي الصادق إن وُجد بدل خطأ عام.
      console.error("[fahem-chat] model error:", modelErr);
      return json(fallback || { message: genericError });
    }
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
