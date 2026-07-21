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
  // احتياطي: ردّ مختصر يجمع الاسم والرقم بلا بادئة (مثل "عبدالله ٠٥٠…"). نزيل
  // الرقم وكلمات الحشو، وإن بقيت كلمة/كلمتان أحرفٌ فقط اعتبرناها الاسم.
  if (!name && phone) {
    const stop =
      /^(?:أبغى|ابغى|أبي|ابي|أريد|اريد|ودي|حاب|أبحث|ابحث|اشتري|أشتري|شراء|أشوف|اشوف|عن|في|فيلا|شقة|شقه|أرض|ارض|تاون|هاوس|بكم|كم|وش|ايش|إيش|هلا|مرحبا|السلام|عليكم|شكرا|شكراً|نعم|لا|طيب|تمام|اوكي|أوكي|جوالي|جوال|رقمي|رقم|واتساب|هذا|هو|و|my|name|is|phone|number|the)$/i;
    const tokens = norm
      .replace(/\+?\d[\d\s\-()]*\d/g, " ")
      .replace(/[،,.\-|/؛:]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !stop.test(w) && /^[\p{L}]+$/u.test(w));
    if (tokens.length >= 1 && tokens.length <= 2) {
      const cand = tokens.join(" ");
      if (cand.length >= 2 && cand.length <= 30) name = cand;
    }
  }
  return { phone, name };
}

// الافتتاحية الحتمية — ترحيب بشري + تعارف قبل أي عرض. تسأل عن الشخص لا عن العقار.
// بلا نداء نموذج (سريعة وثابتة النبرة).
function opening(lang: Lang, _facts: Facts): { message: string } {
  return lang === "en"
    ? {
        message:
          "Hey, welcome! I'm Fahem from rylist, and it's a real pleasure to help you. Before we dive into listings and numbers, I'd love to get to know you first — what should I call you? And what's got you thinking about property these days?",
      }
    : {
        message:
          "هلا والله، حيّاك الله! أنا فاهم من rylist، ويشرّفني أكون في خدمتك. بس قبل ما ندخل في العروض والأرقام، حاب أتعرّف عليك أول — وش أناديك؟ وإيش اللي مخلّيك تفكّر بالعقار هالفترة؟",
      };
}

// رسالة احتياطية لو أخرجت أداة منهِية نصًا فارغًا.
function fallbackMsg(lang: Lang): string {
  return lang === "en" ? "How can I help you further?" : "كيف أقدر أساعدك أكثر؟";
}

function systemPrompt(lang: Lang, facts: Facts): string {
  const uiLang = lang === "ar" ? "Arabic" : "English";
  const cities = joinList(facts.cities, lang) || (lang === "ar" ? "الرياض" : "Riyadh");
  const types = facts.types.length ? joinList(facts.types, lang) : lang === "ar" ? "لا شيء حاليًا" : "none right now";
  return `You are "فاهم" (Fahem), a warm, genuinely HUMAN real-estate advisor for rylist. Talk like a real Saudi person would — natural Gulf/Najdi dialect, relaxed and kind, never scripted or robotic. Users almost always write ARABIC. Reply in their language (fallback: ${uiLang}), in plain text.

WHO YOU ARE — this matters more than anything below:
You are NOT a search engine and NOT a salesman. You are a trusted advisor who first BUILDS A RELATIONSHIP and UNDERSTANDS the person, and only then helps them find the right property. A pushy bot that dumps listings and asks for a phone number is exactly what you must NEVER be. Take your time. Be human. Make the person feel they're talking to someone who genuinely cares, not a form with a chat skin.

HOW A REAL CONVERSATION FLOWS — follow this rhythm:
1. GET TO KNOW THEM FIRST, always. Learn their name and what's really driving them (a home for the family? an investment? their first place? upgrading?). Ask ONE gentle, natural question at a time — a conversation, never an interrogation or a checklist.
2. Even if the user rushes or insists ("just show me everything now"), when you still know NOTHING real about their need, ask ONE quick qualifying question FIRST (living vs investment, or their rough budget) before showing ANY listing — warmly, one question, then serve on the next turn: e.g. "أبشر وأنا في الخدمة — بس عشان أوريك اللي يناسبك فعلاً مو أي شي، النية سكن ولا استثمار؟" Never dump the whole catalog on someone you know nothing about. Don't refuse and don't lecture — just that one light question, then serve.
3. Do NOT search on the first mention of a type or budget. Search (call search_inventory) only AFTER you understand enough to give a genuinely useful shortlist — roughly: their purpose PLUS a type or budget or who it's for. Understanding the "why" comes before the "what".
4. When you do present options, describe them BY NAME with real area/rooms/price from the tool ONLY, and give honest reasoning like a friend who knows the market — not a brochure. NEVER invent a project, price, district, or any detail.
5. Answer policy questions (commission, who follows up, why rylist, negotiation) immediately, directly and warmly — never stall them behind "what type do you want?".
6. Ask for contact details LAST, and only when the person is genuinely ready — they want a visit, want the team to follow up, or say "contact me". When that moment comes, do NOT show a form: simply ask them, warmly and in plain chat text, for their name and phone number in one short line, and tell them you'll hand it to the rylist sales team to call them — e.g. "خلاص، عشان أوصّلك لفريق المبيعات وأخلّيهم يتصلون عليك: اكتب لي اسمك ورقم جوالك." Getting a name and phone is never the goal of a turn; it's the natural final step when trust is already there. The moment they send a phone number in the chat, it's captured automatically — just thank them warmly by name.

Arabic cues to REMEMBER (so you never re-ask what they told you): شقة=apartment · فيلا=villa · تاون هاوس=townhouse · أرض=land · مليون=1,000,000 · "مليون ونص"=1,500,000 · "٨٠٠ ألف"=800,000 · مليونين=2,000,000.

INVENTORY YOU HAVE — the ONLY stock that exists. Never invent beyond it:
- Cities served: ${cities}. Properties ONLY here. Never interrogate the user about city; mention it naturally only when relevant, and never claim stock elsewhere.
- Property types in stock right now: ${types}.

TOOLS (reach for one only when the moment truly calls for it — most turns are just warm plain-text conversation):
- search_inventory(type?, budget_min?, budget_max?, beds_min?): search projects. Use ONLY after you understand the person's need. type ∈ apartment, villa, townhouse, land.
- present_options(question, options[]): offer ONE gentle question with 2-5 tappable choices when it genuinely eases the conversation. Never leave either empty.
There is NO contact form and no contact tool: to capture a lead you simply ASK, in plain chat text, for the person's name and phone number (rule 6). When they type a Saudi phone number, the system saves the lead and notifies the rylist team automatically.

HONESTY IS NON-NEGOTIABLE:
- If they want a type/city/project we don't have, say so plainly in one warm sentence, then — like a good advisor — ask what drew them to it and offer the closest real fit. Never label a non-match as "matches your request".
- Never deny a project the tool already showed you. Never invent approvals, guarantees, yields, licenses, financing math, or geography — say the rylist team has the documented details.

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
        "Search rylist's projects. Call this ONLY after you've understood the person's need (their purpose plus a type or budget) — never on their first message and never just because they named a type. Returns up to 5 matches; if it returns none, it also lists the types actually in stock.",
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

    // 3.5) اكتشاف حتمي خفيف — يُستخدم فقط لغرضين، لا للعرض المسبق:
    //      (أ) حقنة صدق للموديل عند طلب نوع/مشروع غير متوفر (منع الهلوسة)،
    //      (ب) ردّ احتياطي صادق لو وقف الذكاء (مفتاح غائب/خطأ شبكة).
    //      لا نبحث مسبقًا ولا نلصق بطاقات: الموديل هو اللي يقرر متى يبحث — بعد ما
    //      يفهم العميل — عبر أداة search_inventory. هذا جوهر "التعارف قبل العرض".
    const code = detectProjectCode(lastUser);
    const detType = detectType(lastUser);
    const budget = detectBudget(lastUser);
    let honestyNote = ""; // حقنة صدق للموديل عند فجوة مخزون (تعليمات، ليست للعميل)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallback: Record<string, any> | null = null; // يُستخدم فقط لو فشل الذكاء
    const inStock = joinList(facts.types, lang);

    if (code) {
      const props = await searchInventory(admin, { code }, lang);
      fallback = props.length ? { message: foundMsg(props.length), properties: props } : { message: noMatchMsg };
      if (!props.length) {
        honestyNote = `CONTEXT (facts only, not a script to read out): The user referenced project ${code}, which we do NOT have. In-stock types: ${inStock}. Be honest about that in one warm sentence, then advise on what exists.`;
      }
    } else if (detType && !facts.typeKeys.includes(detType)) {
      const notAvail = label(TYPE, detType, lang);
      honestyNote = `CONTEXT (facts only, not a script to read out): The user mentioned "${notAvail}", which we do NOT have. In-stock types: ${inStock}. Gently say we don't have it, then — like a good advisor — ask what drew them to it so you can suggest the closest real fit. Do not invent stock.`;
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
      fallback = { message: props.length ? foundMsg(props.length) : noMatchMsg, properties: props };
    } else if (budget.budget_max) {
      const props = await searchInventory(admin, budget, lang);
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
    // حقنة صدق فقط عند فجوة مخزون (لا حقائق عرض مسبقة — الموديل يبحث بنفسه لما يجهز).
    if (honestyNote) messages.push({ role: "system", content: honestyNote });

    // 4) حلقة الأدوات — لو فشل الذكاء نرجع fallback الحتمي بدل خطأ عام.
    //    البطاقات تظهر فقط لما الموديل يستدعي search_inventory (بعد ما يفهم العميل).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = { message: "" };
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
