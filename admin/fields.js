import { sb } from "./db.js";
import { LOCALES } from "./config.js";
import { renderAIBar } from "./ai.js";

// taxonomy cache (cities / property types) for select fields
let TAX = null;
async function taxonomy(kind) {
  if (!TAX) { const { data } = await sb.from("taxonomies").select("*"); TAX = data || []; }
  return TAX.filter((t) => t.kind === kind).map((t) => ({ value: t.key, label: t.i18n?.label?.ar || t.key }));
}

// Arabic labels for enum selects that store English values in the DB
const ENUM_AR = {
  available: "متاح", reserved: "محجوز", sold: "مباع",
  draft: "مسودة", published: "منشور",
};
const tabLabel = (code) => (code === "ar" ? "ع" : code === "en" ? "EN" : "中文");

// per-locale editor with language tabs (ع / EN / 中文)
// returns { el, current(), setText(loc,text) } so ✨ (ai.js) can read/write values
function localeTabs(field, value, onLocale) {
  const wrap = document.createElement("div");
  const tabs = document.createElement("div"); tabs.className = "langtabs";
  const pane = document.createElement("div");
  let cur = LOCALES[0].code;
  let ta = null;
  const draw = () => {
    pane.innerHTML = "";
    ta = field.t === "i18n-rich" ? document.createElement("textarea") : document.createElement("input");
    if (field.t === "i18n-rich") ta.rows = 6;
    ta.value = (value && value[cur]) || "";
    ta.oninput = () => onLocale(cur, ta.value);
    pane.appendChild(ta);
  };
  LOCALES.forEach((L) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = tabLabel(L.code);
    if (L.code === cur) b.classList.add("on");
    b.onclick = () => { cur = L.code; [...tabs.children].forEach((c) => c.classList.remove("on")); b.classList.add("on"); draw(); };
    tabs.appendChild(b);
  });
  wrap.append(tabs, pane); draw();
  return {
    el: wrap,
    current: () => cur,
    setText: (loc, text) => { onLocale(loc, text); if (loc === cur && ta) ta.value = text; },
  };
}

export async function uploadImage(prefix, file) {
  if (!file) return null;
  const path = `${prefix}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await sb.storage.from("media").upload(path, file, { upsert: true });
  if (error) { alert(error.message); return null; }
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// renderForm(root, ent, row, onDone) — onDone() is called after save or "back"
export async function renderForm(root, ent, row, onDone) {
  const pk = ent.pk || "id";
  const editing = !!(row && row[pk]);
  root.innerHTML = `<div class="formwrap">
      <div class="fh"><h2>${ent.label} — ${editing ? "تعديل" : "جديد"}</h2>
        <span class="pill" id="aiPill" hidden>✨ مدعوم بالذكاء</span></div>
      <div class="fbody" id="fbody"></div>
    </div>`;
  const fbody = root.querySelector("#fbody");
  const draft = JSON.parse(JSON.stringify(row || {})); draft.i18n = draft.i18n || {};

  for (const f of ent.fields) {
    const isI18n = f.t.startsWith("i18n-");
    const field = document.createElement("div"); field.className = "field" + (isI18n ? " full" : "");
    const label = document.createElement("label"); label.textContent = f.l || f.n;

    if (isI18n) {
      field.appendChild(label);
      const key = f.n.split(".")[1];
      draft.i18n[key] = draft.i18n[key] || {}; // linked object (so tab-switch keeps typed text on new rows)
      const value = draft.i18n[key];
      // AI mount point — filled by ai.js (Part B)
      const aibar = document.createElement("div"); aibar.className = "aibar"; aibar.id = "ai-" + key; aibar.dataset.field = f.n;
      field.appendChild(aibar);
      const tabs = localeTabs(f, value, (loc, val) => { value[loc] = val; });
      field.appendChild(tabs.el);
      renderAIBar(aibar, { field: f, ent, draft, tabs });
    } else if (f.t === "bool") {
      label.style.flexDirection = "row"; label.style.alignItems = "center"; label.style.gap = "8px";
      const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!draft[f.n];
      input.onchange = () => draft[f.n] = input.checked;
      label.prepend(input); field.appendChild(label);
    } else if (f.t === "select") {
      field.appendChild(label);
      const input = document.createElement("select");
      const opts = Array.isArray(f.options) ? f.options.map((v) => ({ value: v, label: ENUM_AR[v] || v })) : await taxonomy(f.options.split(":")[1]);
      opts.forEach((o) => { const op = document.createElement("option"); op.value = o.value; op.textContent = o.label; input.appendChild(op); });
      const val = draft[f.n] ?? opts[0]?.value;
      input.value = val; draft[f.n] = val;
      input.onchange = () => draft[f.n] = input.value;
      field.appendChild(input);
    } else if (f.t === "image") {
      field.appendChild(label);
      const box = document.createElement("div"); box.style.display = "flex"; box.style.flexDirection = "column"; box.style.gap = "8px";
      const cur = document.createElement("input"); cur.value = draft[f.n] || ""; cur.placeholder = "رابط الصورة"; cur.oninput = () => draft[f.n] = cur.value;
      const img = document.createElement("input"); img.type = "file"; img.accept = "image/*";
      img.onchange = async () => { const url = await uploadImage(ent.table, img.files[0]); if (url) { cur.value = url; draft[f.n] = url; } };
      box.append(cur, img); field.appendChild(box);
    } else {
      field.appendChild(label);
      const input = document.createElement("input"); input.type = f.t === "number" ? "number" : "text"; input.value = draft[f.n] ?? "";
      input.oninput = () => draft[f.n] = f.t === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
      field.appendChild(input);
    }
    fbody.appendChild(field);
  }

  const savebar = document.createElement("div"); savebar.className = "savebar";
  const save = document.createElement("button"); save.className = "btn btn-primary"; save.type = "button"; save.textContent = "حفظ";
  const back = document.createElement("button"); back.className = "btn"; back.type = "button"; back.textContent = "رجوع";
  savebar.append(save, back); fbody.appendChild(savebar);

  const done = () => { if (typeof onDone === "function") onDone(); };
  back.onclick = done;
  save.onclick = async () => {
    save.disabled = true;
    const res = draft[pk]
      ? await sb.from(ent.table).update(draft).eq(pk, draft[pk])
      : await sb.from(ent.table).insert(draft);
    save.disabled = false;
    if (res.error) { alert(res.error.message); return; }
    done();
  };
}
