# RYLIST — خطة تنفيذ المرحلة ١ب: لوحة التحكم

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development أو superpowers:executing-plans. الخطوات بصيغة `- [ ]`.

**Goal:** لوحة تحكم `/admin/` (JS صِرف، بلا build) تسجّل دخول ٣ أدمن وتدير كل المحتوى (CRUD + رفع صور + صندوق الطلبات + زر نشر) عبر خلفية Supabase من الخطة (أ).

**Architecture:** معماريّة **مدفوعة بالإعدادات**: ملف `entities.js` يصف كل نوع محتوى (حقوله)، ومحرّك عام في `ui.js` يرسم القوائم والنماذج ويحفظ — فلا تكرار كود لكل جدول. `@supabase/supabase-js` من ESM CDN. الحقول القابلة للترجمة تُحرَّر بتبويبات لغة وتُجمَّع في عمود `i18n` (jsonb).

**Tech Stack:** HTML/CSS/JS صِرف · `@supabase/supabase-js@2` (esm.sh) · Supabase Auth/Postgres/Storage.

> **يعتمد على:** الخطة (أ) مطبّقة (الجداول + RLS + `is_admin()` + bucket `media`).
> **قرار موفّر للوقت/التوكِن:** لا نظام اختبارات آلي لواجهة buildless — التحقّق **يدوي بالمتصفّح** + استعلام Supabase للتأكيد. (يطابق أولويتك: سرعة وتوفير.)

---

### Task 0: أدمن + مفاتيح

- [ ] **Step 1:** أنشئ ٣ مستخدمي أدمن في Supabase (Authentication → Add user، بريد+كلمة مرور، بلا تسجيل عام). سجّل الـ`user id` لكل واحد.
- [ ] **Step 2:** أدخلهم في `admins` عبر `execute_sql`:
```sql
insert into public.admins (user_id, email) values
  ('<uid1>','<email1>'), ('<uid2>','<email2>'), ('<uid3>','<email3>')
on conflict (user_id) do nothing;
```
- [ ] **Step 3:** احصل على `project URL` + `anon (publishable) key` من Settings → API. (غير سرّيين — RLS يحمي.)
- [ ] **Step 4: Commit** (لا ملفات بعد — تخطَّ.)

---

### Task 1: الإعداد وعميل Supabase والدخول

**Files:** Create `admin/config.js`, `admin/db.js`, `admin/index.html`, `admin/admin.css`

- [ ] **Step 1:** `admin/config.js`
```js
export const SUPABASE_URL = "https://<ref>.supabase.co";
export const SUPABASE_ANON_KEY = "<anon-key>";
export const LOCALES = [ { code:"ar", name:"العربية", dir:"rtl" }, { code:"en", name:"English", dir:"ltr" }, { code:"zh", name:"中文", dir:"ltr" } ];
```
- [ ] **Step 2:** `admin/db.js`
```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export async function signIn(email, password){ return sb.auth.signInWithPassword({ email, password }); }
export async function signOut(){ return sb.auth.signOut(); }
export async function currentUser(){ const { data } = await sb.auth.getUser(); return data.user; }
export async function isAdmin(){ const { data, error } = await sb.rpc("is_admin"); return !error && data === true; }
```
- [ ] **Step 3:** `admin/index.html` (هيكل الدخول + التطبيق)
```html
<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>RYLIST — لوحة التحكم</title>
<link rel="stylesheet" href="../assets/css/styles.css">
<link rel="stylesheet" href="admin.css">
</head><body>
<div id="login" class="admin-login">
  <form id="loginForm" class="admin-card">
    <h1>لوحة تحكم RYLIST</h1>
    <input id="email" type="email" placeholder="البريد" required>
    <input id="password" type="password" placeholder="كلمة المرور" required>
    <button type="submit">دخول</button>
    <p id="loginErr" class="admin-err"></p>
  </form>
</div>
<div id="app" class="admin-app" hidden>
  <aside id="nav" class="admin-nav"></aside>
  <main id="view" class="admin-view"></main>
</div>
<script type="module" src="app.js"></script>
</body></html>
```
- [ ] **Step 4:** `admin/admin.css` — أعِد استخدام توكِنز `styles.css`. حد أدنى:
```css
.admin-login{min-height:100vh;display:grid;place-items:center}
.admin-card{display:flex;flex-direction:column;gap:.7rem;min-width:300px;padding:2rem;border:1px solid #0001;border-radius:12px}
.admin-app{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
.admin-nav{border-inline-end:1px solid #0001;padding:1rem;display:flex;flex-direction:column;gap:.3rem}
.admin-nav button{text-align:start;padding:.5rem .7rem;border:0;background:none;cursor:pointer;border-radius:8px}
.admin-nav button.active{background:#0000000d;font-weight:600}
.admin-view{padding:1.5rem;overflow:auto}
.admin-err{color:#c00}
table.admin-tbl{width:100%;border-collapse:collapse}
.admin-tbl th,.admin-tbl td{border-bottom:1px solid #0001;padding:.5rem;text-align:start}
.admin-form{display:flex;flex-direction:column;gap:.6rem;max-width:640px}
.admin-tabs{display:flex;gap:.3rem;margin-bottom:.3rem}
.admin-tabs button{padding:.2rem .6rem}.admin-tabs button.active{font-weight:700}
input,select,textarea{padding:.45rem;border:1px solid #0002;border-radius:8px;font:inherit}
```
- [ ] **Step 5: تحقّق** — بعد Task 2 (app.js) تفتح `/admin/index.html` بخادم محلي (`npx serve .`) وتسجّل دخول بأحد الأدمن، يجب أن يختفي الدخول ويظهر التطبيق.
- [ ] **Step 6: Commit** `git add admin/ && git commit -m "feat(admin): config, supabase client, login shell, styles"`

---

### Task 2: هيكل التطبيق والتوجيه

**Files:** Create `admin/app.js`

- [ ] **Step 1:** `admin/app.js`
```js
import { sb, signIn, signOut, currentUser, isAdmin } from "./db.js";
import { ENTITIES } from "./entities.js";
import { renderList } from "./ui.js";
import { renderLeads } from "./leads.js";
import { renderPublish } from "./publish.js";

const loginEl=document.getElementById("login"), appEl=document.getElementById("app");
const navEl=document.getElementById("nav"), viewEl=document.getElementById("view");

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const { error } = await signIn(email.value, password.value);
  document.getElementById("loginErr").textContent = error ? "بيانات غير صحيحة" : "";
  if(!error) boot();
});

async function boot(){
  const u = await currentUser();
  if(!u || !(await isAdmin())){ appEl.hidden=true; loginEl.hidden=false; return; }
  loginEl.hidden=true; appEl.hidden=false;
  buildNav(); route("leads");
}
function buildNav(){
  const items=[["leads","الطلبات"],...ENTITIES.map(e=>[e.key,e.label]),["publish","نشر"]];
  navEl.innerHTML="";
  for(const [key,label] of items){
    const b=document.createElement("button"); b.textContent=label;
    b.onclick=()=>{ [...navEl.children].forEach(c=>c.classList.remove("active")); b.classList.add("active"); route(key); };
    navEl.appendChild(b);
  }
  const out=document.createElement("button"); out.textContent="خروج"; out.onclick=async()=>{ await signOut(); location.reload(); };
  navEl.appendChild(out);
}
function route(key){
  viewEl.innerHTML="";
  if(key==="leads") return renderLeads(viewEl);
  if(key==="publish") return renderPublish(viewEl);
  const ent=ENTITIES.find(e=>e.key===key); if(ent) renderList(viewEl, ent);
}
boot();
```
- [ ] **Step 2: تحقّق** — بعد Tasks 3–6، القائمة تعرض كل الأقسام والتنقّل يشتغل.
- [ ] **Step 3: Commit** `git add admin/app.js && git commit -m "feat(admin): app shell, nav, routing"`

---

### Task 3: إعدادات الكيانات (كل الجداول)

**Files:** Create `admin/entities.js`

> هذا **بيانات** لا كود مكرّر: كل كيان وحقوله. أنواع الحقول: `text`,`number`,`bool`,`select`,`image`,`i18n-text`,`i18n-rich`. `select.options` إمّا مصفوفة قيم، أو `"taxonomy:city"`/`"taxonomy:property_type"`.

- [ ] **Step 1:** `admin/entities.js`
```js
export const ENTITIES = [
  { key:"projects", label:"العقارات", table:"projects", order:"sort_order", title:"i18n.title", fields:[
    {n:"code",t:"text",l:"الكود",req:true},
    {n:"city_key",t:"select",l:"المدينة",options:"taxonomy:city"},
    {n:"type_key",t:"select",l:"النوع",options:"taxonomy:property_type"},
    {n:"status",t:"select",l:"الحالة",options:["available","sold"]},
    {n:"sold",t:"number",l:"نسبة البيع"},
    {n:"price_min",t:"number",l:"سعر من"},{n:"price_max",t:"number",l:"سعر إلى"},
    {n:"area",t:"text",l:"المساحة"},{n:"beds_min",t:"number",l:"غرف من"},{n:"beds_max",t:"number",l:"غرف إلى"},
    {n:"featured",t:"bool",l:"مميّز"},{n:"sort_order",t:"number",l:"الترتيب"},
    {n:"image_url",t:"image",l:"الصورة"},
    {n:"i18n.title",t:"i18n-text",l:"العنوان"},{n:"i18n.district",t:"i18n-text",l:"الحي"},
    {n:"i18n.description",t:"i18n-rich",l:"الوصف"} ]},
  { key:"news", label:"الأخبار/المدونة", table:"news", order:"published_at", title:"i18n.title", fields:[
    {n:"slug",t:"text",l:"المعرّف slug",req:true},
    {n:"status",t:"select",l:"الحالة",options:["draft","published"]},
    {n:"published_at",t:"text",l:"تاريخ النشر (ISO)"},
    {n:"image_url",t:"image",l:"الصورة"},
    {n:"i18n.title",t:"i18n-text",l:"العنوان"},{n:"i18n.excerpt",t:"i18n-text",l:"المقتطف"},
    {n:"i18n.body",t:"i18n-rich",l:"النص"} ]},
  { key:"partners", label:"الشركاء", table:"partners", order:"sort_order", title:"i18n.name", fields:[
    {n:"logo_url",t:"image",l:"الشعار"},{n:"sort_order",t:"number",l:"الترتيب"},
    {n:"i18n.name",t:"i18n-text",l:"الاسم"} ]},
  { key:"stats", label:"الأرقام", table:"stats", order:"sort_order", title:"i18n.label", fields:[
    {n:"value",t:"number",l:"القيمة",req:true},{n:"suffix",t:"text",l:"اللاحقة"},
    {n:"sort_order",t:"number",l:"الترتيب"},{n:"i18n.label",t:"i18n-text",l:"العنوان"} ]},
  { key:"social_links", label:"السوشيال", table:"social_links", order:"sort_order", title:"platform", fields:[
    {n:"platform",t:"select",l:"المنصّة",options:["instagram","x","tiktok","snapchat","linkedin","youtube","facebook"]},
    {n:"url",t:"text",l:"الرابط",req:true},{n:"enabled",t:"bool",l:"مفعّل"},{n:"sort_order",t:"number",l:"الترتيب"} ]},
  { key:"contact", label:"التواصل", table:"contact", order:"id", single:true, title:"email", fields:[
    {n:"whatsapp",t:"text",l:"واتساب (دولي بلا +)"},{n:"email",t:"text",l:"البريد"},{n:"phone",t:"text",l:"الهاتف"},
    {n:"map_url",t:"text",l:"رابط الخريطة"},
    {n:"i18n.address",t:"i18n-text",l:"العنوان"},{n:"i18n.hours",t:"i18n-text",l:"ساعات العمل"} ]},
  { key:"pages", label:"الصفحات", table:"pages", order:"key", pk:"key", title:"key", fields:[
    {n:"i18n.title",t:"i18n-text",l:"العنوان"},{n:"i18n.body",t:"i18n-rich",l:"النص"} ]},
];
```
- [ ] **Step 2: Commit** `git add admin/entities.js && git commit -m "feat(admin): entity field configs (config-driven CRUD)"`

---

### Task 4: المحرّك العام (قائمة + نموذج + حفظ/حذف)

**Files:** Create `admin/ui.js`

- [ ] **Step 1:** `admin/ui.js`
```js
import { sb } from "./db.js";
import { LOCALES } from "./config.js";
let TAX = null;
async function taxonomy(kind){ if(!TAX){ const {data}=await sb.from("taxonomies").select("*"); TAX=data||[]; }
  return TAX.filter(t=>t.kind===kind).map(t=>({ value:t.key, label:t.i18n?.label?.ar || t.key })); }

const get=(row,path)=> path.split(".").reduce((o,k)=>o?.[k], row);
function localeTabs(field, value, onLocale){
  const wrap=document.createElement("div");
  const tabs=document.createElement("div"); tabs.className="admin-tabs";
  const pane=document.createElement("div");
  let cur=LOCALES[0].code;
  const draw=()=>{ pane.innerHTML="";
    const ta=field.t==="i18n-rich"?document.createElement("textarea"):document.createElement("input");
    if(field.t==="i18n-rich") ta.rows=6;
    ta.value=(value&&value[cur])||""; ta.oninput=()=>onLocale(cur, ta.value); pane.appendChild(ta); };
  LOCALES.forEach(L=>{ const b=document.createElement("button"); b.type="button"; b.textContent=L.name;
    if(L.code===cur)b.classList.add("active");
    b.onclick=()=>{ cur=L.code; [...tabs.children].forEach(c=>c.classList.remove("active")); b.classList.add("active"); draw(); };
    tabs.appendChild(b); });
  wrap.append(tabs, pane); draw(); return wrap;
}

export async function renderList(root, ent){
  root.innerHTML=`<h2>${ent.label}</h2>`;
  const addBtn=document.createElement("button"); addBtn.textContent="+ إضافة";
  addBtn.onclick=()=>renderForm(root, ent, {}); root.appendChild(addBtn);
  const { data, error } = await sb.from(ent.table).select("*").order(ent.order, { ascending:true });
  if(error){ root.insertAdjacentHTML("beforeend", `<p class="admin-err">${error.message}</p>`); return; }
  const tbl=document.createElement("table"); tbl.className="admin-tbl";
  tbl.innerHTML=`<tr><th>العنوان/المعرّف</th><th></th></tr>`;
  (data||[]).forEach(row=>{
    const title = ent.title.startsWith("i18n.") ? (get(row, ent.title)?.ar || "—") : (row[ent.title.replace("i18n.","")] ?? row[ent.pk||"id"]);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${title}</td>`;
    const td=document.createElement("td");
    const edit=document.createElement("button"); edit.textContent="تعديل"; edit.onclick=()=>renderForm(root, ent, row);
    const del=document.createElement("button"); del.textContent="حذف"; del.onclick=async()=>{
      if(!confirm("حذف؟"))return; await sb.from(ent.table).delete().eq(ent.pk||"id", row[ent.pk||"id"]); renderList(root, ent); };
    td.append(edit, del); tr.appendChild(td); tbl.appendChild(tr);
  });
  root.appendChild(tbl);
}

export async function renderForm(root, ent, row){
  root.innerHTML=`<h2>${ent.label} — ${row[ent.pk||"id"]?"تعديل":"جديد"}</h2>`;
  const form=document.createElement("form"); form.className="admin-form";
  const draft=JSON.parse(JSON.stringify(row||{})); draft.i18n=draft.i18n||{};
  for(const f of ent.fields){
    const label=document.createElement("label"); label.textContent=f.l||f.n;
    let input;
    if(f.t.startsWith("i18n-")){
      const key=f.n.split(".")[1];
      input=localeTabs(f, draft.i18n[key], (loc,val)=>{ draft.i18n[key]=draft.i18n[key]||{}; draft.i18n[key][loc]=val; });
    } else if(f.t==="bool"){ input=document.createElement("input"); input.type="checkbox"; input.checked=!!draft[f.n]; input.onchange=()=>draft[f.n]=input.checked; }
    else if(f.t==="select"){ input=document.createElement("select");
      const opts = Array.isArray(f.options)? f.options.map(v=>({value:v,label:v})) : await taxonomy(f.options.split(":")[1]);
      opts.forEach(o=>{ const op=document.createElement("option"); op.value=o.value; op.textContent=o.label; input.appendChild(op); });
      input.value=draft[f.n]??opts[0]?.value; input.onchange=()=>draft[f.n]=input.value; draft[f.n]=input.value; }
    else if(f.t==="image"){ input=document.createElement("div");
      const img=document.createElement("input"); img.type="file"; img.accept="image/*";
      const cur=document.createElement("input"); cur.value=draft[f.n]||""; cur.placeholder="رابط الصورة"; cur.oninput=()=>draft[f.n]=cur.value;
      img.onchange=async()=>{ const url=await uploadImage(ent.table, img.files[0]); if(url){ cur.value=url; draft[f.n]=url; } };
      input.append(cur, img); }
    else { input=document.createElement("input"); input.type=f.t==="number"?"number":"text"; input.value=draft[f.n]??"";
      input.oninput=()=>draft[f.n]= f.t==="number" ? (input.value===""?null:Number(input.value)) : input.value; }
    label.appendChild(input); form.appendChild(label);
  }
  const save=document.createElement("button"); save.textContent="حفظ"; save.type="submit";
  const back=document.createElement("button"); back.textContent="رجوع"; back.type="button"; back.onclick=()=>renderList(root, ent);
  form.append(save, back);
  form.onsubmit=async(e)=>{ e.preventDefault();
    const pk=ent.pk||"id"; let res;
    if(draft[pk]) res=await sb.from(ent.table).update(draft).eq(pk, draft[pk]);
    else res=await sb.from(ent.table).insert(draft);
    if(res.error) alert(res.error.message); else renderList(root, ent);
  };
  root.appendChild(form);
}

export async function uploadImage(prefix, file){
  if(!file) return null;
  const path=`${prefix}/${Date.now()}-${file.name.replace(/[^\w.\-]/g,"_")}`;
  const { error }=await sb.storage.from("media").upload(path, file, { upsert:true });
  if(error){ alert(error.message); return null; }
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}
```
- [ ] **Step 2: تحقّق (يدوي)** — سجّل دخول، افتح «العقارات»: تظهر ٣ صفوف. اضغط «إضافة»، عبّئ الكود + تبويبات العنوان (ع/EN)، احفظ. تأكّد عبر `execute_sql`: `select code, i18n->'title'->>'en' from public.projects order by created_at desc limit 1;`
- [ ] **Step 3: Commit** `git add admin/ui.js && git commit -m "feat(admin): generic list/form engine with i18n tabs + image upload"`

---

### Task 5: صندوق الطلبات

**Files:** Create `admin/leads.js`

- [ ] **Step 1:** `admin/leads.js`
```js
import { sb } from "./db.js";
const STAT=["new","contacted","closed"], AR={new:"جديد",contacted:"تم التواصل",closed:"مغلق"};
export async function renderLeads(root){
  root.innerHTML="<h2>الطلبات الواردة</h2>";
  const { data, error }=await sb.from("leads").select("*").order("created_at",{ascending:false});
  if(error){ root.insertAdjacentHTML("beforeend",`<p class="admin-err">${error.message}</p>`); return; }
  const tbl=document.createElement("table"); tbl.className="admin-tbl";
  tbl.innerHTML="<tr><th>الاسم</th><th>الجوال</th><th>العقار</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th></tr>";
  (data||[]).forEach(r=>{
    const tr=document.createElement("tr");
    const sel=`<select data-id="${r.id}">${STAT.map(s=>`<option value="${s}" ${s===r.status?"selected":""}>${AR[s]}</option>`).join("")}</select>`;
    tr.innerHTML=`<td>${r.name||""}</td><td>${r.phone||""}</td><td>${r.project_code||""}</td><td>${r.message||""}</td><td>${sel}</td><td>${new Date(r.created_at).toLocaleString("ar")}</td>`;
    tbl.appendChild(tr);
  });
  tbl.addEventListener("change", async(e)=>{ if(e.target.tagName==="SELECT"){
    await sb.from("leads").update({status:e.target.value}).eq("id", e.target.dataset.id); }});
  root.appendChild(tbl);
}
```
- [ ] **Step 2: تحقّق** — أضف صف اختبار: `insert into public.leads(name,phone,source) values('اختبار','0500000000','form');` ثم افتح «الطلبات» — يظهر، وغيّر الحالة وتأكّد عبر `select status from leads where name='اختبار';`. احذفه بعدها.
- [ ] **Step 3: Commit** `git add admin/leads.js && git commit -m "feat(admin): leads inbox with status change"`

---

### Task 6: زر النشر

**Files:** Create `admin/publish.js`

> يستدعي Edge Function `publish` (من الخطة ج). حتى قبل نشرها، الزر يُبنى ويعرض حالة.

- [ ] **Step 1:** `admin/publish.js`
```js
import { sb } from "./db.js";
export function renderPublish(root){
  root.innerHTML="<h2>نشر الموقع</h2><p>يعيد توليد الموقع الثابت من المحتوى الحالي (~دقيقة).</p>";
  const btn=document.createElement("button"); btn.textContent="نشر الآن";
  const msg=document.createElement("p");
  btn.onclick=async()=>{ btn.disabled=true; msg.textContent="جارٍ إطلاق النشر…";
    const { data:{ session } }=await sb.auth.getSession();
    const res=await sb.functions.invoke("publish", { headers:{ Authorization:`Bearer ${session.access_token}` } });
    msg.textContent = res.error ? ("فشل: "+res.error.message) : "تم إطلاق النشر ✅ (يظهر خلال دقيقة).";
    btn.disabled=false;
  };
  root.append(btn, msg);
}
```
- [ ] **Step 2: تحقّق** — بعد نشر Edge Function (الخطة ج)، الضغط يطلق بناء Vercel.
- [ ] **Step 3: Commit** `git add admin/publish.js && git commit -m "feat(admin): publish button invoking publish edge function"`

---

## المراجعة الذاتية
- دخول ٣ أدمن + منع غير الأدمن → Task 0,1,2 (`isAdmin`). ✓
- CRUD لكل ٧ أنواع بلا كود مكرّر → Task 3 (config) + Task 4 (engine). ✓
- تبويبات لغة تُجمَّع في `i18n` → Task 4 `localeTabs`. ✓
- رفع صور → Task 4 `uploadImage`. ✓
- صندوق الطلبات + حالة → Task 5. ✓
- زر نشر → Task 6. ✓
- تناسق: `sb`, `ENTITIES`, `renderList/renderForm`, `is_admin` rpc — متطابقة عبر المهام. ✓

## التالي: الخطة (ج) — الموقع العام + بايبلاين النشر.
