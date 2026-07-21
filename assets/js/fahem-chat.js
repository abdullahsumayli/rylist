/* ==========================================================================
   فاهم — مستشار rylist العقاري (صفحة محادثة مستقلة)
   - يشتغل داخل صفحة fahem.html: يربط عناصر ثابتة (خيط الرسائل + المُنشئ)
     ويبدأ المحادثة عند التحميل. لا لوحة منبثقة ولا زر عائم — الأيقونة العائمة
     في باقي الصفحات مجرّد رابط <a> يودّي لهذه الصفحة.
   - نفس منطق edge (fahem-chat) والتقاط العميل في جدول leads بمصدر chat.
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
  priceOnRequest: { ar: "السعر عند الطلب", en: "Price on request" },
  error: { ar: "عذراً، صار خطأ. جرّب مرة ثانية.", en: "Sorry, something went wrong. Please try again." },
};
const tr = (k) => T[k][isAr() ? "ar" : "en"];

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

/* ----- الحالة ----- */
let started = false;
let loading = false;
let interestCode = null; // مشروع أبدى العميل اهتمامًا به (لربط الـ lead).
const msgs = []; // [{ role, content, quickReplies?, properties? }]

// جوال سعودي مكتوب داخل الشات (05xxxxxxxx أو +9665…) — الالتقاط يتم في edge بالخدمة،
// وهذا فقط لتوسيم المحادثة كمحوّلة لطلب في الأرشيف.
function detectPhone(text) {
  const norm = String(text || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const digits = norm.replace(/[\s\-()]/g, "");
  const m = digits.match(/(?:(?:\+?966|00966)5\d{8})|(?:05\d{8})/);
  return m ? m[0] : null;
}

// أرشفة المحادثة: معرّف جلسة يُولّد مرّة، وحالة تحوّلها لطلب (lead).
let sessionId = null;
let leadCaptured = false;
let leadPhone = null;
function ensureSession() {
  if (sessionId) return;
  sessionId =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    Date.now().toString(16) + "-" + Math.random().toString(16).slice(2);
}

/* ----- أرشفة المحادثة في fahem_conversations (best-effort) ----- */
async function persistConversation() {
  // لا نحفظ زيارة بلا أي رسالة عميل (تفادي صفوف فارغة لكل فتح للصفحة).
  const firstUser = msgs.find((m) => m.role === "user");
  if (!firstUser) return;
  ensureSession();
  const transcript = msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const row = { role: m.role, content: m.content || "" };
      if (m.properties && m.properties.length) {
        row.properties = m.properties.map((p) => ({
          code: p.code,
          title: p.title,
          price_min: p.price_min,
          price_max: p.price_max,
        }));
      }
      return row;
    });
  const payload = {
    session_id: sessionId,
    transcript,
    lang: lang(),
    msg_count: transcript.length,
    first_message: firstUser.content.slice(0, 500),
    became_lead: leadCaptured,
  };
  if (leadPhone) payload.phone = leadPhone;
  try {
    // إضافة فقط: كل دور يكتب صفًّا يحمل النص الكامل حتى الآن؛ الأدمن يأخذ الأكمل
    // لكل session_id. (RLS يمنع anon من UPDATE، فالإضافة أأمن وبلا تسريب.) created_at
    // يُدار من الـ DB.
    await sb.from("fahem_conversations").insert(payload);
  } catch {
    /* أرشفة best-effort — لا تعطّل المحادثة */
  }
}

let els = {};

/* ----- النص الحر (المسار الأساسي) → البحث/المحادثة في edge ----- */
function history() {
  return msgs.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: m.content }));
}

async function startChat() {
  interestCode = null;
  setLoading(true);
  try {
    const { data, error } = await sb.functions.invoke("fahem-chat", { body: { language: lang(), start: true } });
    if (error) throw error;
    pushAssistant(data);
  } catch {
    pushAssistant({ message: tr("error") });
  } finally {
    setLoading(false);
  }
}

async function send(text) {
  const clean = (text || "").trim();
  if (!clean || loading) return;
  msgs.push({ role: "user", content: clean });
  // العميل كتب رقمه داخل المحادثة → التقاط الطلب يتم في edge؛ نوسم المحادثة محوّلة.
  const ph = detectPhone(clean);
  if (ph) {
    leadCaptured = true;
    leadPhone = ph;
  }
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
  });
  render();
  void persistConversation();
}

function setLoading(v) {
  loading = v;
  els.sendBtn.disabled = v;
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
    '<div class="fahem-card__title">' + esc(p.title) + "</div>" +
    (loc ? '<div class="fahem-card__loc">' + loc + "</div>" : "") +
    '<div class="fahem-card__price">' + esc(fmtPrice(p.price_min, p.price_max)) + "</div>" +
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
  });
  if (loading) {
    html += '<div class="fahem-row fahem-row--assistant"><div class="fahem-typing"><span></span><span></span><span></span></div></div>';
  }
  els.thread.innerHTML = html;

  // ربط الأزرار السريعة: كل زر يرسل نصّه كرسالة حرة.
  els.thread.querySelectorAll(".fahem-chip").forEach((b) => {
    b.addEventListener("click", () => send(b.textContent));
  });

  els.scroll.scrollTop = els.scroll.scrollHeight;
}

/* ----- الإقلاع ----- */
function boot() {
  const thread = document.querySelector(".fahem-thread");
  if (!thread) return; // لسنا في صفحة فاهم.
  els = {
    thread,
    scroll: document.querySelector(".fahem-scroll"),
    form: document.querySelector(".fahem-composer"),
    input: document.querySelector(".fahem-input"),
    sendBtn: document.querySelector(".fahem-sendbtn"),
  };

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(els.input.value);
  });

  if (!started) {
    started = true;
    void startChat();
    // preventScroll: focusing the composer must NOT scroll the intro + chat
    // header out of view on load.
    setTimeout(() => els.input.focus({ preventScroll: true }), 200);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
