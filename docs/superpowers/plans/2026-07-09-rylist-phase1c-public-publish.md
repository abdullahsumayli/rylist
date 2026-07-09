# RYLIST — خطة تنفيذ المرحلة ١ج: الموقع العام + بايبلاين النشر

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development أو superpowers:executing-plans. الخطوات بصيغة `- [ ]`.

**Goal:** تحويل الموقع الثابت ليُولَّد من Supabase عند «النشر»: صفحات SEO لكل لغة (`/`, `/en/`, `/zh/`) + صفحة لكل عقار + sitemap/hreflang، مع ربط نموذج الطلبات بـ`leads`، وأيقونة واتساب عائمة، وروابط السوشيال، وEdge Function للنشر على Vercel.

**Architecture:** سكربت بناء Node (`scripts/build.mjs`) يقرأ Supabase بمفتاح `service_role` ويولّد الناتج في `dist/`. يعيد استخدام نمط الترجمة الحالي (سمات `data-en`) ويوسّعه لـ`data-zh`: يُصيّر النص لكل لغة **وقت البناء** (SEO حقيقي) بدل client-side. Vercel يشغّل البناء عبر Deploy Hook يطلقه زر النشر.

**Tech Stack:** Node 24 (ESM) · `@supabase/supabase-js` + `node-html-parser` (devDeps للبناء) · Supabase Edge Function (Deno) · Vercel.

> **يعتمد على:** الخطة (أ) الخلفية. يتكامل مع زر النشر في الخطة (ب).
> **قرار موفّر للوقت:** قوائم المشاريع/الأخبار تبقى client-side من `data.js` المُولَّد؛ **صفحات العقار المفردة** هي مصدر SEO الأساسي (server-rendered لكل لغة) + وجهات الإعلان. النصوص الثابتة تُصيَّر وقت البناء.

---

### Task 0: تهيئة البناء والاستضافة

**Files:** Create `package.json`, `vercel.json`, `.env.example`

- [ ] **Step 1:** `package.json`
```json
{
  "name": "rylist-site",
  "private": true,
  "type": "module",
  "scripts": { "build": "node scripts/build.mjs" },
  "devDependencies": { "@supabase/supabase-js": "^2.45.0", "node-html-parser": "^6.1.13" }
}
```
- [ ] **Step 2:** `npm install` (يولّد `node_modules/` + lockfile؛ `node_modules/` مستثنى في .gitignore).
- [ ] **Step 3:** `vercel.json`
```json
{ "buildCommand": "npm run build", "outputDirectory": "dist" }
```
- [ ] **Step 4:** `.env.example`
```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=__set_in_vercel_env__
SITE_URL=https://rylist.sa
```
- [ ] **Step 5: Commit** `git add package.json package-lock.json vercel.json .env.example && git commit -m "chore(build): scaffold build tooling and vercel config"`

---

### Task 1: البناء — قراءة Supabase وتوليد data.js

**Files:** Create `scripts/build.mjs`, `scripts/lib/fetchContent.mjs`

- [ ] **Step 1:** `scripts/lib/fetchContent.mjs`
```js
import { createClient } from "@supabase/supabase-js";
export async function fetchContent(){
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const grab = async (t, order)=> (await sb.from(t).select("*").order(order,{ascending:true})).data || [];
  const [locales, taxonomies, projects, news, partners, stats, social] = await Promise.all([
    grab("locales","sort_order"), grab("taxonomies","sort_order"),
    grab("projects","sort_order"),
    (await sb.from("news").select("*").eq("status","published").order("published_at",{ascending:false})).data||[],
    grab("partners","sort_order"), grab("stats","sort_order"), grab("social_links","sort_order"),
  ]);
  const contact = (await sb.from("contact").select("*").eq("id",1).single()).data || {};
  const pages = Object.fromEntries(((await sb.from("pages").select("*")).data||[]).map(p=>[p.key,p.i18n]));
  return { locales: locales.filter(l=>l.enabled), taxonomies, projects, news, partners, stats,
           social: social.filter(s=>s.enabled), contact, pages };
}
```
- [ ] **Step 2:** `scripts/build.mjs` (الهيكل — الدوال تُضاف في المهام التالية)
```js
import fs from "node:fs"; import path from "node:path";
import { fetchContent } from "./lib/fetchContent.mjs";
import { writeDataJs } from "./lib/dataJs.mjs";
import { renderPages } from "./lib/renderPages.mjs";
import { renderProjectPages } from "./lib/projectPages.mjs";
import { writeSitemap } from "./lib/sitemap.mjs";

const OUT = "dist";
const SITE = process.env.SITE_URL || "https://rylist.sa";

async function main(){
  const c = await fetchContent();
  fs.rmSync(OUT, { recursive:true, force:true }); fs.mkdirSync(OUT, { recursive:true });
  // انسخ الأصول الثابتة
  for(const p of ["assets","favicon.svg","robots.txt",".nojekyll"]) if(fs.existsSync(p)) fs.cpSync(p, path.join(OUT,p), { recursive:true });
  writeDataJs(OUT, c);
  renderPages(OUT, c, SITE);
  renderProjectPages(OUT, c, SITE);
  writeSitemap(OUT, c, SITE);
  console.log("Build done →", OUT);
}
main().catch(e=>{ console.error(e); process.exit(1); });
```
- [ ] **Step 3:** `scripts/lib/dataJs.mjs`
```js
import fs from "node:fs";
export function writeDataJs(out, c){
  const data = {
    locales: c.locales, taxonomies: c.taxonomies, projects: c.projects,
    news: c.news, partners: c.partners, stats: c.stats, contact: c.contact, social: c.social,
  };
  fs.mkdirSync(out+"/assets/js", { recursive:true });
  fs.writeFileSync(out+"/assets/js/data.js", "window.RYLIST_DATA = "+JSON.stringify(data)+";\n");
}
```
- [ ] **Step 4: تحقّق** — عيّن `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` محليًّا (shell مؤقت، لا تحفظهما):
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node -e "import('./scripts/lib/fetchContent.mjs').then(m=>m.fetchContent()).then(c=>console.log(c.projects.length,'projects,',c.locales.length,'locales'))"
```
Expected: يطبع عدد المشاريع (≥3) وعدد اللغات المفعّلة (2: ar,en).
- [ ] **Step 5: Commit** `git add scripts/ && git commit -m "feat(build): fetch content + generate data.js"`

---

### Task 2: البناء — تصيير الصفحات الثابتة لكل لغة (SEO)

**Files:** Create `scripts/lib/renderPages.mjs`; Modify الصفحات الست لإضافة `data-zh` + وسم عنصر المبدّل.

> النمط: الصفحات الحالية تحمل العربية في HTML و`data-en` للإنجليزي. نضيف `data-zh` للصيني. البناء يُصيّر ملفًا لكل لغة مفعّلة: للعربية يترك النص، ولغيرها يستبدل نص كل عنصر بقيمة `data-<locale>`، ويضبط `lang/dir`، ويحقن hreflang/canonical، ويعيد كتابة روابط المبدّل.

- [ ] **Step 1:** `scripts/lib/renderPages.mjs`
```js
import fs from "node:fs"; import { parse } from "node-html-parser";
const PAGES = ["index.html","projects.html","services.html","about.html","news.html","contact.html"];

function localizeHtml(html, locale, dir, siteUrl, pageName){
  const root = parse(html, { comment:true });
  const htmlEl = root.querySelector("html"); htmlEl.setAttribute("lang", locale); htmlEl.setAttribute("dir", dir);
  if(locale !== "ar"){
    root.querySelectorAll(`[data-${locale}]`).forEach(el=>{ el.set_content(el.getAttribute(`data-${locale}`)); });
    root.querySelectorAll(`[data-${locale}-ph]`).forEach(el=>{ el.setAttribute("placeholder", el.getAttribute(`data-${locale}-ph`)); });
  }
  // hreflang + canonical
  const head = root.querySelector("head");
  const base = siteUrl.replace(/\/$/,"");
  const url = (loc)=> loc==="ar" ? `${base}/${pageName}` : `${base}/${loc}/${pageName}`;
  head.insertAdjacentHTML("beforeend", `\n<link rel="canonical" href="${url(locale)}">`);
  ["ar","en","zh"].forEach(l=> head.insertAdjacentHTML("beforeend", `\n<link rel="alternate" hreflang="${l}" href="${url(l)}">`));
  return "<!doctype html>\n"+root.toString();
}

export function renderPages(out, c, siteUrl){
  const locales = c.locales; // مفعّلة فقط
  for(const page of PAGES){
    if(!fs.existsSync(page)) continue;
    const src = fs.readFileSync(page, "utf8");
    for(const L of locales){
      const dir = L.code==="ar" ? "" : `/${L.code}`;
      const outDir = out + dir; fs.mkdirSync(outDir, { recursive:true });
      fs.writeFileSync(`${outDir}/${page}`, localizeHtml(src, L.code, L.dir, siteUrl, page));
    }
  }
}
```
- [ ] **Step 2: عدّل الصفحات الست** — لكل عنصر يحمل `data-en` أضِف `data-zh="<الترجمة الصينية>"` (اتركها فارغة `""` مؤقتًا حتى تجهز؛ الصيني معطّل الآن فلن يُصيَّر). عدّل المبدّل ليكون **روابط** بدل زر JS: استبدل `<button data-lang-toggle>` بروابط تُشير لنسخ اللغة (سيتم ملؤها ديناميكيًّا في Task 5 عبر سكربت خفيف يبني الروابط من المسار الحالي).
- [ ] **Step 3: تحقّق** — شغّل `npm run build` (بمتغيّرات البيئة). Expected: `dist/index.html` (عربي) و`dist/en/index.html` (إنجليزي، `lang="en" dir="ltr"`، النص إنجليزي، فيه hreflang). افتح `dist/en/index.html` وتأكّد أن النص إنجليزي.
- [ ] **Step 4: Commit** `git add scripts/lib/renderPages.mjs *.html && git commit -m "feat(build): per-locale static pre-render with hreflang"`

---

### Task 3: البناء — صفحة لكل عقار (SEO + وجهة إعلان)

**Files:** Create `scripts/lib/projectPages.mjs`, `templates/project.html`

- [ ] **Step 1:** `templates/project.html` (قالب بسيط على الهوية)
```html
<!doctype html><html lang="{{lang}}" dir="{{dir}}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}} — RYLIST</title>
<meta name="description" content="{{desc}}">
<link rel="canonical" href="{{canonical}}">{{hreflang}}
<link rel="stylesheet" href="{{assets}}/assets/css/styles.css">
</head><body>
<main class="container">
  <a href="{{home}}">RYLIST</a>
  <h1>{{title}}</h1>
  <img src="{{image}}" alt="{{title}}" style="max-width:100%">
  <p>{{district}} · {{typeLabel}} · {{cityLabel}}</p>
  <p>{{price}}</p>
  <div>{{description}}</div>
  <a href="{{whatsapp}}" target="_blank" rel="noopener">{{cta}}</a>
</main></body></html>
```
- [ ] **Step 2:** `scripts/lib/projectPages.mjs`
```js
import fs from "node:fs";
const CTA = { ar:"استفسر عبر واتساب", en:"Enquire on WhatsApp", zh:"通过 WhatsApp 咨询" };
const tmpl = fs.readFileSync("templates/project.html","utf8");
const fill = (s,map)=> s.replace(/\{\{(\w+)\}\}/g, (_,k)=> map[k] ?? "");
export function renderProjectPages(out, c, siteUrl){
  const base = siteUrl.replace(/\/$/,"");
  const tax = (kind,key,loc)=> c.taxonomies.find(t=>t.kind===kind&&t.key===key)?.i18n?.label?.[loc] || key;
  for(const L of c.locales){ const loc=L.code; const dir = loc==="ar"?"":`/${loc}`;
    const outDir = `${out}${dir}/projects`; fs.mkdirSync(outDir, { recursive:true });
    for(const p of c.projects){
      const t = p.i18n?.title?.[loc] || p.i18n?.title?.ar || p.code;
      const path = (l)=> `${base}${l==="ar"?"":"/"+l}/projects/${p.code}.html`;
      const hreflang = ["ar","en","zh"].map(l=>`\n<link rel="alternate" hreflang="${l}" href="${path(l)}">`).join("");
      const wa = c.contact?.whatsapp ? `https://wa.me/${c.contact.whatsapp}?text=${encodeURIComponent(`${t} (${p.code})`)}` : "#";
      const html = fill(tmpl, {
        lang:loc, dir:L.dir, title:t, desc:(p.i18n?.description?.[loc]||"").slice(0,150),
        canonical:path(loc), hreflang, assets: loc==="ar"?".":"..", home: loc==="ar"?"/":`/${loc}/`,
        image:p.image_url||"", district:p.i18n?.district?.[loc]||"", typeLabel:tax("property_type",p.type_key,loc),
        cityLabel:tax("city",p.city_key,loc),
        price: p.price_min? `${p.price_min.toLocaleString()} – ${(p.price_max||p.price_min).toLocaleString()} ${loc==="en"?"SAR":"ريال"}`:"",
        description:p.i18n?.description?.[loc]||"", whatsapp:wa, cta:CTA[loc]||CTA.ar,
      });
      fs.writeFileSync(`${outDir}/${p.code}.html`, "<!doctype html>\n"+html);
    }
  }
}
```
- [ ] **Step 3: تحقّق** — `npm run build`، ثم تأكّد من وجود `dist/projects/RY-1042.html` و`dist/en/projects/RY-1042.html`، وأن الثاني إنجليزي وفيه `<title>Malqa Peaks — RYLIST</title>`.
- [ ] **Step 4: Commit** `git add scripts/lib/projectPages.mjs templates/ && git commit -m "feat(build): per-project SEO pages per locale"`

---

### Task 4: البناء — sitemap + robots

**Files:** Create `scripts/lib/sitemap.mjs`

- [ ] **Step 1:** `scripts/lib/sitemap.mjs`
```js
import fs from "node:fs";
export function writeSitemap(out, c, siteUrl){
  const base = siteUrl.replace(/\/$/,"");
  const pages=["","projects.html","services.html","about.html","news.html","contact.html"];
  const urls=[];
  for(const L of c.locales){ const pre = L.code==="ar"?"":`/${L.code}`;
    for(const pg of pages) urls.push(`${base}${pre}/${pg}`);
    for(const p of c.projects) urls.push(`${base}${pre}/projects/${p.code}.html`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map(u=>`<url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`;
  fs.writeFileSync(out+"/sitemap.xml", xml);
}
```
- [ ] **Step 2: تحقّق** — `npm run build`، تأكّد `dist/sitemap.xml` يحوي روابط `/` و`/en/` وصفحات العقارات.
- [ ] **Step 3: Commit** `git add scripts/lib/sitemap.mjs && git commit -m "feat(build): sitemap generation"`

---

### Task 5: ربط الواجهة — طلبات + واتساب + سوشيال + مبدّل

**Files:** Create `assets/js/public.js`; Modify الصفحات (تضمين السكربت + عناصر واتساب/سوشيال)

- [ ] **Step 1:** `assets/js/public.js` (يُحمَّل في كل الصفحات؛ anon key عام)
```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://<ref>.supabase.co", SUPABASE_ANON_KEY="<anon-key>";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const lang = document.documentElement.lang || "ar";

// (١) نموذج الطلبات → INSERT في leads
const form = document.getElementById("interestForm");
if(form) form.addEventListener("submit", async (e)=>{
  e.preventDefault(); const d = new FormData(form);
  const { error } = await sb.from("leads").insert({
    name:d.get("name"), phone:d.get("phone"), email:d.get("email"),
    project_code:d.get("project"), message:d.get("message"), source:"form", locale:lang });
  const msg=document.getElementById("formMsg");
  if(msg) msg.textContent = error ? "تعذّر الإرسال، حاول مجددًا" : "تم استلام طلبك ✅";
  if(!error) form.reset();
});

// (٢) مبدّل اللغة = روابط حقيقية بين نسخ اللغة
document.querySelectorAll("[data-lang-link]").forEach(a=>{
  const target=a.getAttribute("data-lang-link"); // "ar" | "en" | "zh"
  const p=location.pathname.replace(/^\/(en|zh)\//,"/"); // المسار بلا بادئة لغة
  a.href = target==="ar" ? p : `/${target}${p}`;
});
```
- [ ] **Step 2:** في كل صفحة: (أ) استبدل منطق الإرسال القديم في [main.js:272-285](../../../assets/js/main.js#L272-L285) بإزالته (public.js يتكفّل)، (ب) أضِف رسالة `<p id="formMsg"></p>` قرب النموذج، (ج) اجعل روابط المبدّل `<a data-lang-link="en">EN</a>` و`<a data-lang-link="ar">ع</a>` (و`zh` عند التفعيل)، (د) أضِف أيقونة واتساب عائمة قبل `</body>`:
```html
<a class="wa-float" data-wa-float target="_blank" rel="noopener" aria-label="WhatsApp">
  <svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.9-2.7-1.2-4.4-4-4.5-4.2-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.5.1.3.7 1.1 1.4 1.7.9.8 1.7 1.1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.2z"/></svg>
</a>
```
مع CSS في styles.css: `.wa-float{position:fixed;inset-block-end:20px;inset-inline-end:20px;width:52px;height:52px;border-radius:50%;background:#25D366;display:grid;place-items:center;z-index:50}`
وفي public.js عيّن رابطه: `document.querySelectorAll("[data-wa-float]").forEach(a=>a.href="https://wa.me/"+(window.RYLIST_DATA?.contact?.whatsapp||""));`
- [ ] **Step 3:** روابط السوشيال في الفوتر: أضِف حاوية `<div id="social"></div>` وفي public.js:
```js
const s=document.getElementById("social");
if(s && window.RYLIST_DATA?.social) s.innerHTML = window.RYLIST_DATA.social.map(x=>`<a href="${x.url}" target="_blank" rel="noopener">${x.platform}</a>`).join(" · ");
```
- [ ] **Step 4: تحقّق** — `npm run build`، افتح `dist/contact.html` بخادم محلي، أرسل النموذج، تأكّد عبر `select * from leads order by created_at desc limit 1;` أنه انحفظ بـ`source='form'`. تأكّد أيقونة واتساب والسوشيال تظهران.
- [ ] **Step 5: Commit** `git add assets/js/public.js assets/css/styles.css *.html && git commit -m "feat(public): leads insert, whatsapp float, social links, real lang switcher"`

---

### Task 6: Edge Function للنشر

**Files:** Create `supabase/functions/publish/index.ts`

- [ ] **Step 1:** `supabase/functions/publish/index.ts`
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, content-type" };
  if(req.method==="OPTIONS") return new Response("ok",{ headers:cors });
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global:{ headers:{ Authorization:auth } } });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if(isAdmin !== true) return new Response(JSON.stringify({ error:"unauthorized" }), { status:401, headers:cors });
  const hook = Deno.env.get("VERCEL_DEPLOY_HOOK");
  if(!hook) return new Response(JSON.stringify({ error:"deploy hook not set" }), { status:500, headers:cors });
  await fetch(hook, { method:"POST" });
  return new Response(JSON.stringify({ ok:true }), { headers:cors });
});
```
- [ ] **Step 2:** انشر الدالة عبر `mcp__supabase-samaile__deploy_edge_function` (name `publish`, محتوى الملف أعلاه). عيّن أسرارها في Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, و`VERCEL_DEPLOY_HOOK` (يُنشأ في Task 7).
- [ ] **Step 3: تحقّق** — من لوحة التحكم (الخطة ب) اضغط «نشر الآن» كأدمن → يرجع `ok`. كأدمن غير مسجّل → 401.
- [ ] **Step 4: Commit** `git add supabase/functions/publish/index.ts && git commit -m "feat(publish): admin-gated edge function triggering vercel deploy hook"`

---

### Task 7: نشر Vercel والتحقّق النهائي

- [ ] **Step 1:** أنشئ مشروع Vercel، اربط مستودع GitHub. Build Command: `npm run build`، Output: `dist`.
- [ ] **Step 2:** أضِف متغيّرات بيئة Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (سرّ)، `SITE_URL`.
- [ ] **Step 3:** أنشئ **Deploy Hook** (Settings → Git → Deploy Hooks)، وضع رابطه في سرّ Supabase `VERCEL_DEPLOY_HOOK`.
- [ ] **Step 4:** أول نشر (push إلى GitHub أو Deploy يدوي).
- [ ] **Step 5: تحقّق نهائي (AC للمرحلة ١):**
  - `/` عربي و`/en/` إنجليزي صفحات ثابتة حقيقية + hreflang. ✓ (AC-1.7)
  - `/projects/RY-1042.html` يفتح ومصيَّر. ✓
  - النموذج يحفظ في `leads` ويظهر في صندوق اللوحة. ✓ (AC-1.5)
  - أيقونة واتساب + السوشيال تعملان. ✓ (AC-1.8)
  - زر «نشر» من اللوحة يطلق بناء Vercel ويظهر التغيير. ✓ (AC-1.6)
- [ ] **Step 6:** لإطلاق الصيني لاحقًا: من اللوحة فعّل locale `zh`، عبّئ ترجماته، «نشر» → يظهر `/zh/`.

---

## المراجعة الذاتية
- SEO متعدّد اللغات (صفحات + hreflang) → Task 2,3,4. ✓ (AC-1.7)
- صفحة لكل عقار → Task 3. ✓
- نموذج → leads → Task 5. ✓ (AC-1.5)
- واتساب عائمة + سوشيال → Task 5. ✓ (AC-1.8)
- نشر → توليد ثابت → Task 1–4 + Task 6,7. ✓ (AC-1.6)
- تفعيل الصيني بلا إعادة بناء → Task 7 Step 6 + `locales.enabled`. ✓ (AC-1.9)
- الموقع ثابت، لا قراءة قاعدة وقت التشغيل عدا INSERT الطلبات → data.js مُولَّد + public.js INSERT فقط. ✓ (AC-1.10)

**فجوات:** تصيير قوائم المشاريع/الأخبار server-side مؤجّل عمدًا (client-side من data.js)؛ SEO مغطّى بصفحات العقار المفردة. حسّنه لاحقًا لو لزم.
