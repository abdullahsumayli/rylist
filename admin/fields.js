import { sb } from "./db.js";
import { LOCALES } from "./config.js";
import { makeSlug } from "./slug.js";
import { richEditor } from "./richeditor.js";
import { checkImageSpec } from "./imageSpec.js";

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
// حقل المقال (i18n-rich) يستخدم محرّرًا غنيًّا (صور/جداول/روابط)؛ بقيّة الحقول input عادي.
export function localeTabs(field, value, onLocale) {
  const wrap = document.createElement("div");
  const tabs = document.createElement("div"); tabs.className = "langtabs";
  const pane = document.createElement("div");
  let cur = LOCALES[0].code;
  const rich = field.t === "i18n-rich";
  let ctl = null;   // current control: { get, set }

  const draw = () => {
    pane.innerHTML = "";
    const loc = cur;   // اربط هذا المحرّر بلغته وقت الإنشاء — لا بـ cur المتغيّر
    if (rich) {        // (يمنع أن يكتب رفعُ صورة مؤجّل نتيجتَه في اللغة الخطأ بعد تبديل التبويب)
      const ed = richEditor({ table: "news" });
      ed.setHTML((value && value[loc]) || "");
      // contenteditable يُطلق "input" ويصعد للعنصر الحاوي — نلتقطه لمزامنة المسودة
      ed.el.addEventListener("input", () => onLocale(loc, ed.getHTML()));
      pane.appendChild(ed.el);
      ctl = { get: () => ed.getHTML(), set: (v) => ed.setHTML(v) };
    } else {
      const inp = document.createElement("input");
      inp.value = (value && value[loc]) || "";
      inp.oninput = () => onLocale(loc, inp.value);
      pane.appendChild(inp);
      ctl = { get: () => inp.value, set: (v) => { inp.value = v; } };
    }
  };

  LOCALES.forEach((L) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = tabLabel(L.code);
    if (L.code === cur) b.classList.add("on");
    b.onclick = () => {
      if (ctl) onLocale(cur, ctl.get());              // احفظ اللغة الحالية قبل التبديل
      cur = L.code; [...tabs.children].forEach((c) => c.classList.remove("on")); b.classList.add("on"); draw();
    };
    tabs.appendChild(b);
  });
  wrap.append(tabs, pane); draw();
  return {
    el: wrap,
    current: () => cur,
    setText: (loc, text) => { onLocale(loc, text); if (loc === cur && ctl) ctl.set(text); },
  };
}

export async function uploadImage(prefix, file) {
  if (!file) return null;
  const path = `${prefix}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await sb.storage.from("media").upload(path, file, { upsert: true });
  if (error) { alert(error.message); return null; }
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// قياس أبعاد الصورة — للتحقّق من مواصفات الحقل قبل الرفع (الحجم المقروء في imageSpec.js)
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
        // تحقّق من مواصفات الحقل (شعار الشركاء، صورة الهيرو…) قبل الرفع، ونبّه المستخدم إن تجاوزها
        if (f.spec) {
          const dims = f.t === "image" ? await imageDims(file) : { w: 0, h: 0 };
          const bad = checkImageSpec(f.spec, file.size, dims);
          if (bad) {
            status.hidden = false; status.className = "uploadstatus is-warn";
            status.textContent = "⚠ " + (f.l || "الملف") + ": " + bad.has + ". المطلوب " + bad.need + " — عدّله قبل الرفع. ";
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

  const done = () => { if (typeof onDone === "function") onDone(); };

  // enforce req:true fields (declared in entities.js) before hitting the DB —
  // otherwise an empty NOT NULL column surfaces as a raw Postgres error.
  const requireFields = () => {
    const missing = ent.fields.filter((f) => f.req && !String(draft[f.n] ?? "").trim());
    if (!missing.length) return true;
    alert("الحقول التالية مطلوبة: " + missing.map((f) => f.l || f.n).join("، "));
    return false;
  };

  // slug مخفيّ يُشتق من العنوان تلقائيًا (للكيانات التي تخفي حقل slug)
  const ensureSlug = () => {
    if (!ent.slugFrom || String(draft.slug || "").trim()) return;
    const key = ent.slugFrom.startsWith("i18n.") ? ent.slugFrom.split(".")[1] : null;
    const title = key ? (draft.i18n?.[key]?.en || draft.i18n?.[key]?.ar || "") : draft[ent.slugFrom];
    draft.slug = makeSlug(title);
  };

  const persist = () => draft[pk]
    ? sb.from(ent.table).update(draft).eq(pk, draft[pk])
    : sb.from(ent.table).insert(draft);

  const savebar = document.createElement("div"); savebar.className = "savebar";
  const back = document.createElement("button"); back.className = "btn"; back.type = "button"; back.textContent = "رجوع";
  back.onclick = done;

  if (ent.workflow === "draft") {
    // مسودة / معاينة / نشر — للمدونة: راجِع ثم انشر
    const publishBtn = document.createElement("button"); publishBtn.className = "btn btn-primary"; publishBtn.type = "button"; publishBtn.textContent = "نشر";
    const draftBtn = document.createElement("button"); draftBtn.className = "btn"; draftBtn.type = "button"; draftBtn.textContent = "حفظ كمسودة";
    const previewBtn = document.createElement("button"); previewBtn.className = "btn"; previewBtn.type = "button"; previewBtn.textContent = "معاينة";

    draftBtn.onclick = async () => {
      if (!requireFields()) return;
      ensureSlug(); draft.status = "draft";
      draftBtn.disabled = true;
      const res = await persist();
      draftBtn.disabled = false;
      if (res.error) { alert(res.error.message); return; }
      done();
    };

    previewBtn.onclick = () => {
      // تسليم محلي للمتصفّح — بلا كتابة لقاعدة البيانات ولا نشر
      try {
        localStorage.setItem("rylist:news-preview", JSON.stringify({
          slug: draft.slug || "", image_url: draft.image_url || "",
          i18n: draft.i18n || {}, published_at: draft.published_at || new Date().toISOString(),
        }));
        window.open("../article.html?preview=1", "_blank", "noopener");
      } catch (e) { alert("تعذّرت المعاينة: " + (e?.message || e)); }
    };

    publishBtn.onclick = async () => {
      if (!requireFields()) return;
      ensureSlug(); draft.status = "published";
      if (!String(draft.published_at || "").trim()) draft.published_at = new Date().toISOString();
      publishBtn.disabled = true; publishBtn.textContent = "جارٍ النشر…";
      const res = await persist();
      if (res.error) { publishBtn.disabled = false; publishBtn.textContent = "نشر"; alert(res.error.message); return; }
      // أطلق بناء الموقع ليظهر للزوّار (نفس آلية صفحة «نشر»)
      try {
        const { data: { session } } = await sb.auth.getSession();
        const dep = await sb.functions.invoke("publish", { headers: { Authorization: `Bearer ${session?.access_token}` } });
        if (dep.error) throw new Error(dep.error.message);
        alert("تم نشر المقال ✓ سيظهر على الموقع خلال دقيقة تقريبًا.");
      } catch (e) {
        alert("حُفظ المقال كمنشور ✓ لكن تعذّر إطلاق النشر تلقائيًا (" + (e?.message || e) + ").\nافتح صفحة «نشر» واضغط الزر لإظهاره على الموقع.");
      }
      done();
    };

    savebar.append(publishBtn, draftBtn, previewBtn, back);
  } else {
    const save = document.createElement("button"); save.className = "btn btn-primary"; save.type = "button"; save.textContent = "حفظ";
    save.onclick = async () => {
      if (!requireFields()) return;
      save.disabled = true;
      const res = await persist();
      save.disabled = false;
      if (res.error) { alert(res.error.message); return; }
      done();
    };
    savebar.append(save, back);
  }
  fbody.appendChild(savebar);
}
