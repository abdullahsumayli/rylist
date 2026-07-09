import { sb } from "./db.js";

const ACTIONS = {
  generate: "✨ توليد",
  improve: "تحسين",
  translate: "ترجمة",
  seo: "عنوان‑SEO",
  ideas: "أفكار",
};

// which ✨ buttons to show for a given field type
function actionsFor(field) {
  const base = ["generate", "improve", "translate"];
  base.push(field.t === "i18n-rich" ? "ideas" : "seo");
  return base;
}

// grounding data sent to the model
function buildContext(ent, draft) {
  if (ent.key === "projects") {
    return {
      code: draft.code, city: draft.city_key, type: draft.type_key, status: draft.status,
      priceMin: draft.price_min, priceMax: draft.price_max,
      bedsMin: draft.beds_min, bedsMax: draft.beds_max, area: draft.area,
      title: draft.i18n?.title?.ar, district: draft.i18n?.district?.ar,
    };
  }
  return { title: draft.i18n?.title?.ar };
}

async function invokeAI(payload) {
  const { data: { session } } = await sb.auth.getSession();
  const { data, error } = await sb.functions.invoke("ai-assist", {
    body: payload,
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (error) {
    // supabase-js wraps a non-2xx response as FunctionsHttpError; the real
    // message is in the Response body on error.context, not error.message.
    let msg = error.message;
    try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* keep generic */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// renderAIBar(aibar, { field, ent, draft, tabs }) — tabs: { current(), setText(loc,text) }
export function renderAIBar(aibar, { field, ent, draft, tabs }) {
  const key = field.n.split(".")[1];
  aibar.innerHTML = "";

  const msg = document.createElement("div");
  msg.className = "aihint"; msg.hidden = true; msg.style.width = "100%";
  const ideas = document.createElement("div");
  ideas.className = "aihint"; ideas.hidden = true; ideas.style.width = "100%"; ideas.style.whiteSpace = "pre-wrap"; ideas.style.color = "var(--text-2)";

  const showMsg = (t, err) => { msg.hidden = false; msg.textContent = t; msg.style.color = err ? "var(--sold)" : "var(--text-3)"; };

  for (const action of actionsFor(field)) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "aibtn"; btn.textContent = ACTIONS[action];
    btn.onclick = async () => {
      btn.classList.add("busy"); showMsg("✨ جارٍ…", false);
      try {
        const loc = tabs.current();
        const data = await invokeAI({
          action, entity: ent.key, field: key, locale: loc,
          text: draft.i18n?.[key]?.[loc] || "",
          targetLocales: ["ar", "en", "zh"].filter((l) => l !== loc),
          context: buildContext(ent, draft),
        });
        if (action === "translate") {
          Object.entries(data.translations || {}).forEach(([l, t]) => tabs.setText(l, t));
          showMsg("✅ تُرجم إلى باقي اللغات.", false);
        } else if (action === "ideas") {
          ideas.hidden = false; ideas.textContent = data.result;
          showMsg("💡 أفكار مقترحة — انسخ ما يعجبك.", false);
        } else {
          tabs.setText(loc, data.result);
          showMsg("✅ جاهز — عدّله كما تشاء.", false);
        }
      } catch (e) {
        showMsg("فشل: " + (e?.message || e), true);
      } finally {
        btn.classList.remove("busy");
      }
    };
    aibar.appendChild(btn);
  }
  aibar.appendChild(msg);
  aibar.appendChild(ideas);
}
