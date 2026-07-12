/* ==========================================================================
   فاهم — مستشار rylist العقاري بالمحادثة (ودجت واجهة مستقل بذاته)
   - يحقن زرًا عائمًا "استشير فاهم" ولوحة محادثة في أي صفحة.
   - التدفّق الموجّه (الغرض → النوع → الميزانية) أزرار ثابتة في العميل — مضمون
     100% ومستقل عن تذبذب الموديل. الذكاء (edge) يُستدعى فقط للبحث، ولنص العميل
     الحر كخيار احتياطي.
   - يلتقط العميل مباشرة في جدول leads (RLS يسمح لـ anon) بمصدر chat.
   ========================================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// نفس القيم العامة المستخدمة في assets/js/public.js و admin/config.js.
const SUPABASE_URL = "https://ghtcwsbtyvczlznviojj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGN3c2J0eXZjemx6bnZpb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NTA2NjMsImV4cCI6MjA5OTEyNjY2M30.dv4RFD_e3vfRFFMPTZFaVAYZARTzELgOccSew8rLZXc";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const lang = () => (document.documentElement.getAttribute("lang") === "en" ? "en" : "ar");
const isAr = () => lang() === "ar";

/* ----- النصوص (عربي/إنجليزي) ----- */
const T = {
  launcher: { ar: "استشير فاهم", en: "Ask Fahem" },
  title: { ar: "فاهم", en: "Fahem" },
  subtitle: { ar: "مستشارك العقاري · rylist", en: "Your real-estate advisor · rylist" },
  placeholder: { ar: "أو اكتب سؤالك…", en: "Or type your question…" },
  send: { ar: "إرسال", en: "Send" },
  close: { ar: "إغلاق", en: "Close" },
  contactTitle: { ar: "بياناتك للتواصل", en: "Your contact details" },
  name: { ar: "الاسم", en: "Name" },
  phone: { ar: "رقم الجوال", en: "Phone number" },
  submit: { ar: "اطلب يتواصلون معك", en: "Request a call back" },
  trustFree: { ar: "خدمتنا مجانية — ما تدفع أي عمولة", en: "Our service is free — you pay no commission" },
  trustRouting: {
    ar: "فريق rylist نفسه يتواصل معك ويتابع معك كل شيء",
    en: "The rylist team itself contacts you and follows up on everything",
  },
  thanks: {
    ar: "تم! فريق rylist بيتواصل معك قريبًا ويتابع معك خطوة بخطوة. خدمتنا مجانية 100%.",
    en: "Done! The rylist team will contact you soon and follow up step by step. Our service is 100% free.",
  },
  leadError: { ar: "تعذّر الإرسال، حاول مرة ثانية.", en: "Couldn’t send, please try again." },
  error: { ar: "عذراً، صار خطأ. جرّب مرة ثانية.", en: "Sorry, something went wrong. Please try again." },
  view: { ar: "شاهد التفاصيل", en: "View details" },
  beds: { ar: "غرف", en: "beds" },
  area: { ar: "م²", en: "m²" },
  priceOnRequest: { ar: "السعر عند الطلب", en: "Price on request" },
  afterSearch: {
    ar: "عجبك مشروع؟ اترك اسمك وجوالك ويتواصل معك فريق rylist ويرتّب لك كل شيء — مجانًا.",
    en: "Like a project? Leave your name and phone and the rylist team will reach out and arrange everything — free.",
  },
  restart: { ar: "ابحث من جديد", en: "Start over" },
};
const tr = (k) => T[k][isAr() ? "ar" : "en"];

// خطوات التدفّق الموجّه (أزرار ثابتة) — [نص الزر, القيمة].
const GUIDE = () =>
  isAr()
    ? {
        purpose: {
          q: "هلا والله! أنا فاهم، مستشارك العقاري في rylist. وش ناوي عليه؟",
          opts: [["سكن", "living"], ["استثمار", "investment"]],
        },
        type: {
          q: "تمام. وش نوع العقار اللي يناسبك؟",
          opts: [["شقة", "apartment"], ["فيلا", "villa"], ["تاون هاوس", "townhouse"], ["أرض", "land"], ["أي نوع", ""]],
        },
        budget: {
          q: "وش ميزانيتك التقريبية؟",
          opts: [
            ["أقل من مليون", "|1000000"],
            ["مليون – ١.٥", "1000000|1500000"],
            ["١.٥ – ٢ مليون", "1500000|2000000"],
            ["أكثر من ٢ مليون", "2000000|"],
            ["أي ميزانية", "|"],
          ],
        },
      }
    : {
        purpose: {
          q: "Hi! I'm Fahem, your rylist real-estate advisor. What are you looking for?",
          opts: [["To live", "living"], ["To invest", "investment"]],
        },
        type: {
          q: "Great. What type of property suits you?",
          opts: [["Apartment", "apartment"], ["Villa", "villa"], ["Townhouse", "townhouse"], ["Land", "land"], ["Any type", ""]],
        },
        budget: {
          q: "What's your approximate budget?",
          opts: [
            ["Under 1M", "|1000000"],
            ["1M – 1.5M", "1000000|1500000"],
            ["1.5M – 2M", "1500000|2000000"],
            ["Over 2M", "2000000|"],
            ["Any budget", "|"],
          ],
        },
      };

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fmtPrice(min, max) {
  if (!min && !max) return tr("priceOnRequest");
  const lo = min || max,
    hi = max || min;
  const f = (x) => Number(x).toLocaleString("en-US");
  const range = lo === hi ? f(lo) : f(lo) + " – " + f(hi);
  return isAr() ? range + " ريال" : "SAR " + range;
}

function metaLine(p) {
  const parts = [];
  if (p.area) parts.push(p.area + " " + tr("area"));
  if (p.beds_max > 0) {
    const beds = p.beds_min === p.beds_max ? String(p.beds_min) : p.beds_min + "–" + p.beds_max;
    parts.push(beds + " " + tr("beds"));
  }
  return parts.join(" · ");
}

/* ----- الحالة ----- */
let started = false;
let loading = false;
let interestCode = null; // مشروع أبدى العميل اهتمامًا به (لربط الـ lead).
let criteria = { purpose: null, type: null, budget_min: null, budget_max: null }; // من التدفّق الموجّه.
const msgs = []; // [{ role, content, quickReplies?, guidedPhase?, guidedOpts?, properties?, showContactForm? }]

let els = {};

/* ----- بناء الهيكل ----- */
function buildShell() {
  const fab = document.createElement("button");
  fab.className = "fahem-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", tr("launcher"));
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M11 2l1.6 5.4L18 9l-5.4 1.6L11 16l-1.6-5.4L4 9l5.4-1.6z"/><path d="M18.5 14l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8z"/></svg>' +
    '<span class="fahem-fab__label"></span>';

  const backdrop = document.createElement("div");
  backdrop.className = "fahem-backdrop";

  const panel = document.createElement("aside");
  panel.className = "fahem-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", tr("title"));
  panel.innerHTML =
    '<header class="fahem-head">' +
    '<div class="fahem-head__id">' +
    '<span class="fahem-head__mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 2l1.6 5.4L18 9l-5.4 1.6L11 16l-1.6-5.4L4 9l5.4-1.6z"/><path d="M18.5 14l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8z"/></svg></span>' +
    '<span class="fahem-head__text"><b class="fahem-head__title"></b><small class="fahem-head__sub"></small></span>' +
    "</div>" +
    '<button class="fahem-head__x" type="button" aria-label=""></button>' +
    "</header>" +
    '<div class="fahem-scroll"><div class="fahem-thread"></div></div>' +
    '<form class="fahem-composer">' +
    '<input class="fahem-input" type="text" autocomplete="off" enterkeyhint="send">' +
    '<button class="fahem-sendbtn" type="submit"></button>' +
    "</form>";

  document.body.appendChild(fab);
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  els = {
    fab,
    backdrop,
    panel,
    thread: panel.querySelector(".fahem-thread"),
    scroll: panel.querySelector(".fahem-scroll"),
    form: panel.querySelector(".fahem-composer"),
    input: panel.querySelector(".fahem-input"),
    sendBtn: panel.querySelector(".fahem-sendbtn"),
    closeBtn: panel.querySelector(".fahem-head__x"),
  };

  applyStrings();

  fab.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  els.closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.panel.classList.contains("is-open")) close();
  });
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(els.input.value);
  });
}

function applyStrings() {
  els.fab.querySelector(".fahem-fab__label").textContent = tr("launcher");
  els.fab.setAttribute("aria-label", tr("launcher"));
  els.panel.querySelector(".fahem-head__title").textContent = tr("title");
  els.panel.querySelector(".fahem-head__sub").textContent = tr("subtitle");
  els.closeBtn.setAttribute("aria-label", tr("close"));
  els.closeBtn.textContent = "✕";
  els.input.setAttribute("placeholder", tr("placeholder"));
  els.sendBtn.textContent = tr("send");
}

/* ----- فتح/إغلاق ----- */
function open() {
  els.panel.classList.add("is-open");
  els.backdrop.classList.add("is-open");
  document.body.style.overflow = "hidden";
  if (!started) {
    started = true;
    startGuided();
  }
  setTimeout(() => els.input.focus(), 260);
}

function close() {
  els.panel.classList.remove("is-open");
  els.backdrop.classList.remove("is-open");
  document.body.style.overflow = "";
}

/* ----- التدفّق الموجّه (أزرار ثابتة، بلا نداء موديل) ----- */
function askGuided(phase) {
  const step = GUIDE()[phase];
  msgs.push({
    role: "assistant",
    content: step.q,
    quickReplies: step.opts.map((o) => o[0]),
    guidedOpts: step.opts,
    guidedPhase: phase,
  });
  render();
}

function startGuided() {
  criteria = { purpose: null, type: null, budget_min: null, budget_max: null };
  interestCode = null;
  askGuided("purpose");
}

function onGuided(phase, value, label) {
  // سجّل جواب العميل كفقاعة.
  msgs.push({ role: "user", content: label });
  if (phase === "purpose") {
    criteria.purpose = value;
    render();
    askGuided("type");
  } else if (phase === "type") {
    criteria.type = value || null;
    render();
    askGuided("budget");
  } else if (phase === "budget") {
    const parts = String(value).split("|");
    criteria.budget_min = parts[0] ? Number(parts[0]) : null;
    criteria.budget_max = parts[1] ? Number(parts[1]) : null;
    render();
    void doSearch();
  } else if (phase === "postsearch") {
    startGuided(); // "ابحث من جديد"
  }
}

/* ----- نداء البحث الحتمي (edge — بلا موديل) ----- */
async function doSearch() {
  const payload = {
    language: lang(),
    search: {
      type: criteria.type || undefined,
      budget_min: criteria.budget_min || undefined,
      budget_max: criteria.budget_max || undefined,
    },
  };
  setLoading(true);
  try {
    const { data, error } = await sb.functions.invoke("fahem-chat", { body: payload });
    if (error) throw error;
    msgs.push({ role: "assistant", content: (data && data.message) || "", properties: (data && data.properties) || null });
    // خطوة التواصل بعد النتائج.
    msgs.push({
      role: "assistant",
      content: tr("afterSearch"),
      showContactForm: true,
      quickReplies: [tr("restart")],
      guidedOpts: [[tr("restart"), ""]],
      guidedPhase: "postsearch",
    });
    render();
  } catch {
    msgs.push({ role: "assistant", content: tr("error") });
    render();
  } finally {
    setLoading(false);
  }
}

/* ----- النص الحر (احتياطي) → مسار الذكاء الكامل في edge ----- */
function history() {
  return msgs.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }));
}

async function send(text) {
  const clean = (text || "").trim();
  if (!clean || loading) return;
  msgs.push({ role: "user", content: clean });
  els.input.value = "";
  render();
  setLoading(true);
  try {
    const { data, error } = await sb.functions.invoke("fahem-chat", { body: { language: lang(), messages: history() } });
    if (error) throw error;
    pushAssistant(data);
  } catch {
    pushAssistant({ message: tr("error") });
  } finally {
    setLoading(false);
  }
}

function pushAssistant(data) {
  if (data && data.projectCode) interestCode = data.projectCode;
  msgs.push({
    role: "assistant",
    content: (data && data.message) || "",
    quickReplies: (data && data.quickReplies) || null,
    properties: (data && data.properties) || null,
    showContactForm: !!(data && data.showContactForm),
  });
  render();
}

function setLoading(v) {
  loading = v;
  els.sendBtn.disabled = v;
  render();
}

/* ----- التقاط العميل مباشرة في leads ----- */
async function submitContact(name, phone, msgEl, formEl) {
  const summary = [
    criteria.purpose ? "الغرض: " + criteria.purpose : "",
    criteria.type ? "النوع: " + criteria.type : "",
    criteria.budget_max || criteria.budget_min ? "الميزانية: " + (criteria.budget_min || 0) + "-" + (criteria.budget_max || "") : "",
  ]
    .concat(msgs.filter((m) => m.role === "user").map((m) => m.content))
    .filter(Boolean)
    .join(" | ")
    .slice(0, 1000);
  const { error } = await sb.from("leads").insert({
    name: name,
    phone: phone,
    message: summary,
    project_code: interestCode || null,
    source: "chat",
    locale: lang(),
  });
  if (error) {
    if (msgEl) msgEl.textContent = tr("leadError");
    return;
  }
  if (formEl) formEl.setAttribute("data-done", "1");
  msgs.push({ role: "assistant", content: tr("thanks") });
  render();
}

/* ----- الرسم ----- */
function bubble(role, content) {
  return (
    '<div class="fahem-row fahem-row--' + role + '">' +
    '<div class="fahem-bubble fahem-bubble--' + role + '">' + esc(content) + "</div></div>"
  );
}

function propertyCardHtml(p) {
  const img = p.image_url
    ? '<div class="fahem-card__media"><img loading="lazy" src="' + esc(p.image_url) + '" alt="' + esc(p.title) + '"></div>'
    : "";
  const loc = [p.district, p.city].filter(Boolean).map(esc).join(isAr() ? "، " : ", ");
  return (
    '<a class="fahem-card" href="' + esc(p.url) + '">' +
    img +
    '<div class="fahem-card__body">' +
    (loc ? '<div class="fahem-card__loc">' + loc + "</div>" : "") +
    '<div class="fahem-card__title">' + esc(p.title) + "</div>" +
    (p.type ? '<div class="fahem-card__type">' + esc(p.type) + "</div>" : "") +
    '<div class="fahem-card__foot">' +
    '<b class="fahem-card__price">' + esc(fmtPrice(p.price_min, p.price_max)) + "</b>" +
    '<span class="fahem-card__link">' + tr("view") + " " + (isAr() ? "←" : "→") + "</span>" +
    "</div>" +
    (metaLine(p) ? '<div class="fahem-card__meta">' + esc(metaLine(p)) + "</div>" : "") +
    "</div></a>"
  );
}

function render() {
  const lastIdx = msgs.length - 1;
  let html = "";
  msgs.forEach((m, i) => {
    if (m.content) html += bubble(m.role, m.content);
    if (m.properties && m.properties.length) {
      html += '<div class="fahem-cards">' + m.properties.map(propertyCardHtml).join("") + "</div>";
    }
    if (i === lastIdx && !loading && m.quickReplies && m.quickReplies.length) {
      html +=
        '<div class="fahem-quick">' +
        m.quickReplies.map((q, k) => '<button type="button" class="fahem-chip" data-k="' + k + '">' + esc(q) + "</button>").join("") +
        "</div>";
    }
    if (i === lastIdx && m.showContactForm) {
      html += contactFormHtml();
    }
  });
  if (loading) {
    html += '<div class="fahem-row fahem-row--assistant"><div class="fahem-typing"><span></span><span></span><span></span></div></div>';
  }
  els.thread.innerHTML = html;

  // ربط الأزرار (موجّهة أو نص حر).
  const last = msgs[lastIdx];
  els.thread.querySelectorAll(".fahem-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const k = Number(b.getAttribute("data-k"));
      if (last && last.guidedPhase && last.guidedOpts) {
        const opt = last.guidedOpts[k];
        onGuided(last.guidedPhase, opt[1], opt[0]);
      } else {
        send(b.textContent);
      }
    });
  });

  const cf = els.thread.querySelector(".fahem-lead");
  if (cf && !cf.getAttribute("data-done")) {
    cf.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = cf.querySelector('[name="name"]').value.trim();
      const phone = cf.querySelector('[name="phone"]').value.trim();
      const note = cf.querySelector(".fahem-lead__msg");
      if (name && phone) submitContact(name, phone, note, cf);
    });
  }

  els.scroll.scrollTop = els.scroll.scrollHeight;
}

function contactFormHtml() {
  return (
    '<form class="fahem-lead">' +
    '<div class="fahem-lead__ttl">' + tr("contactTitle") + "</div>" +
    '<input class="fahem-lead__in" name="name" required placeholder="' + esc(tr("name")) + '">' +
    '<input class="fahem-lead__in" name="phone" required inputmode="tel" placeholder="' + esc(tr("phone")) + '">' +
    '<button class="fahem-lead__btn" type="submit">' + esc(tr("submit")) + "</button>" +
    '<div class="fahem-lead__trust"><div>✓ ' + esc(tr("trustFree")) + "</div><div>✓ " + esc(tr("trustRouting")) + "</div></div>" +
    '<div class="fahem-lead__msg" role="status"></div>' +
    "</form>"
  );
}

/* ----- توصيل نقاط الإطلاق ----- */
function wireLaunchers() {
  document.querySelectorAll(".nav__cta, [data-fahem-open]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
  });
}

function boot() {
  if (document.querySelector(".fahem-panel")) return; // حماية من التحميل المزدوج.
  buildShell();
  wireLaunchers();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
