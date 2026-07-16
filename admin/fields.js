import { sb } from "./db.js";
import { LOCALES } from "./config.js";

// taxonomy cache (cities / property types) for select fields
let TAX = null;
async function taxonomy(kind) {
  if (!TAX) { const { data } = await sb.from("taxonomies").select("*"); TAX = data || []; }
  return TAX.filter((t) => t.kind === kind).map((t) => ({ value: t.key, label: t.i18n?.label?.ar || t.key }));
}

// Arabic labels for enum selects that store English values in the DB
const ENUM_AR = {
  available: "متاح", reserved: "محجوز", sold: "مباع", soon: "قريبًا",
  draft: "مسودة", published: "منشور",
};
const tabLabel = (code) => (code === "ar" ? "ع" : code === "en" ? "EN" : "中文");

// per-locale editor with language tabs (ع / EN / 中文)
// returns { el, current(), setText(loc,text) }
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

// حجم مقروء (KB/MB) + قياس أبعاد الصورة — للتحقّق من مواصفات الشعار قبل الرفع
function fmtBytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB"; }
function imageDims(file) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { res({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// renderForm(root, ent, row, onDone) — onDone() is called after save or "back"
export async function renderForm(root, ent, row, onDone) {
  const pk = ent.pk || "id";
  const editing = !!(row && row[pk]);
  root.innerHTML = `<div class="formwrap">
      <div class="fh"><h2>${ent.label} — ${editing ? "تعديل" : "جديد"}</h2></div>
      <div class="fbody" id="fbody"></div>
    </div>`;
  const fbody = root.querySelector("#fbody");
  // only tables that actually have i18n fields get an i18n payload — otherwise
  // Postgres rejects the write ("Could not find the 'i18n' column …") for tables
  // like social_links / site_theme that have no i18n column.
  const hasI18n = ent.fields.some((f) => f.t.startsWith("i18n-"));
  const draft = JSON.parse(JSON.stringify(row || {}));
  if (hasI18n) draft.i18n = draft.i18n || {};
  else delete draft.i18n;

  for (const f of ent.fields) {
    const isI18n = f.t.startsWith("i18n-");
    const field = document.createElement("div"); field.className = "field" + (isI18n ? " full" : "");
    const label = document.createElement("label"); label.textContent = f.l || f.n;

    if (isI18n) {
      field.appendChild(label);
      const key = f.n.split(".")[1];
      draft.i18n[key] = draft.i18n[key] || {}; // linked object (so tab-switch keeps typed text on new rows)
      const value = draft.i18n[key];
      const tabs = localeTabs(f, value, (loc, val) => { value[loc] = val; });
      field.appendChild(tabs.el);
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
    } else if (f.t === "image" || f.t === "file") {
      field.appendChild(label);
      const box = document.createElement("div"); box.style.display = "flex"; box.style.flexDirection = "column"; box.style.gap = "8px";
      const cur = document.createElement("input"); cur.value = draft[f.n] || ""; cur.placeholder = f.t === "file" ? "رابط الملف (PDF)" : "رابط الصورة"; cur.oninput = () => draft[f.n] = cur.value;
      const up = document.createElement("input"); up.type = "file"; up.accept = f.t === "file" ? "application/pdf" : "image/*";
      const status = document.createElement("p"); status.className = "uploadstatus"; status.hidden = true;
      const doUpload = async (file) => {
        up.disabled = true; status.hidden = false; status.className = "uploadstatus is-busy";
        status.textContent = "⏳ جارٍ رفع " + (f.l || "الملف") + "…";
        const url = await uploadImage(ent.table, file);
        up.disabled = false;
        if (url) { cur.value = url; draft[f.n] = url; status.className = "uploadstatus is-ok"; status.textContent = "✓ تم رفع " + (f.l || "الملف"); }
        else { status.className = "uploadstatus is-err"; status.textContent = "✗ تعذّر الرفع، حاول مرة أخرى"; }
      };
      up.onchange = async () => {
        const file = up.files[0]; if (!file) return;
        // تحقّق من مواصفات الحقل (شعار الشركاء مثلًا) قبل الرفع، ونبّه المستخدم إن تجاوزها
        if (f.spec) {
          const dims = f.t === "image" ? await imageDims(file) : { w: 0, h: 0 };
          const overSize = f.spec.maxKB && file.size > f.spec.maxKB * 1024;
          const overDim = f.spec.maxW && dims.w && (dims.w > f.spec.maxW || dims.h > f.spec.maxH);
          if (overSize || overDim) {
            const has = ["حجمه " + fmtBytes(file.size)]; if (dims.w) has.push("أبعاده " + dims.w + "×" + dims.h + "px");
            const need = []; if (f.spec.maxKB) need.push("≤ " + f.spec.maxKB + "KB"); if (f.spec.recW) need.push("~" + f.spec.recW + "×" + f.spec.recH + "px");
            status.hidden = false; status.className = "uploadstatus is-warn";
            status.textContent = "⚠ هذا الشعار " + has.join(" و") + ". المطلوب " + need.join(" و") + " — صغّره أو صدّره SVG قبل الرفع. ";
            const go = document.createElement("button"); go.type = "button"; go.className = "warngo"; go.textContent = "ارفعه على أي حال";
            go.onclick = () => doUpload(file); status.appendChild(go);
            return;
          }
        }
        doUpload(file);
      };
      box.append(cur, up, status); field.appendChild(box);
    } else {
      field.appendChild(label);
      const input = document.createElement("input"); input.type = f.t === "number" ? "number" : "text"; input.value = draft[f.n] ?? "";
      input.oninput = () => draft[f.n] = f.t === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
      field.appendChild(input);
    }
    if (f.hint) { const h = document.createElement("p"); h.className = "fieldhint"; h.textContent = f.hint; field.appendChild(h); }
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
