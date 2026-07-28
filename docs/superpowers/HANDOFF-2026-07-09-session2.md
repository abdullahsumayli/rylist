# RYLIST — ملخص تسليم (Handoff) لمحادثة جديدة · جلسة ٢ · 2026-07-09

## المشروع
موقع RYLIST العقاري + لوحة تحكم (Admin CMS).
- **Supabase:** مشروع "rylist" · ref `ghtcwsbtyvczlznviojj` (وصول MCP كامل: apply_migration / execute_sql / deploy_edge_function / get_logs).
- **GitHub:** `abdullahsumayli/rylist` · فرع `main` = الإنتاج (Vercel ينشر تلقائيًا عند كل push لـmain).
- **Vercel:** مشروع "rylist" (حساب شخصي، **غير مربوط بـMCP** — أي إجراء بلوحة Vercel يدوي).

## الروابط والدخول
- الموقع العام: **https://rylist.sa**
- لوحة الأدمن: **https://rylist.sa/admin/** · إيميل `sumayliabdullah@gmail.com` · باسورد مؤقت `abc12345` (**لازم يتغيّر — أمني**).

---

## ✅ أُنجز في هذه الجلسة (بالكامل، منشور ومتحقَّق بالمتصفّح)

### الجزء أ — إعادة تصميم اللوحة + حالة «محجوز»
- إعادة تصميم كاملة للّوحة بهوية RYLIST («ترف صامت»: حِبر/عاجي/شامبين). القشرة: قائمة جانبية داكنة + توجيه بلا إعادة تحميل.
- قسم العقارات الغني: بطاقات إحصائية + شبكة بطاقات بصور + بحث/فلاتر.
- حالة عقار جديدة **`reserved` (محجوز)** طرفًا لطرف (قاعدة + لوحة + بناء + صفحة العقار). القيد الآن `('available','reserved','sold')`.
- **تثبيت supabase-js محليًا** في `admin/vendor/supabase.js` (حزمة esbuild) — أُزيل اعتماد esm.sh وقت التشغيل (كان مشتبه عطل «لا تفتح بالوضع الخفي»).
- إصلاح **CORS** في Edge Function `publish` (كان يسقط `x-client-info`/`apikey`) — نُشر كـv3.
- بنية اللوحة الجديدة (ESM صرف، بلا build): `index.html · admin.css · app.js · shell.js · fields.js · projects.js · list.js · leads.js · publish.js · entities.js · config.js · db.js · vendor/supabase.js`. (حُذف `ui.js` القديم.)

### الجزء ب — المساعد الذكي ✨ (المرحلة ٢)
- **Edge Function `ai-assist`** (نُشرت v1، محمية بـ`is_admin()` و`verify_jwt`) تنادي **Claude Opus 4.8** (`claude-opus-4-8`) عبر HTTPS مباشر لـ`api.anthropic.com`.
- أزرار ✨ جنب كل حقل نص i18n: **توليد / تحسين / ترجمة / عنوان‑SEO / أفكار**. الواجهة `admin/ai.js` تملأ حاويات `.aibar`.
- **`ANTHROPIC_API_KEY` أُضيف كسرّ في Supabase** (المستخدم أضافه). تحقّقنا حيًّا: توليد وصف عربي دقيق + ترجمة EN/中 — يعمل ١٠٠٪.

### الأسرار المضبوطة في Supabase
`SUPABASE_URL` · `SUPABASE_ANON_KEY` · `VERCEL_DEPLOY_HOOK` · `ANTHROPIC_API_KEY`.

### وثائق التصميم (في `docs/superpowers/`)
- specs: `admin-cms-design` (الرؤية ٤ مراحل) · `admin-redesign-partA-design` · `ai-assist-partB-design` · `admin-mockup.html` (موكب معتمد).
- plans: `admin-redesign-partA` · phase1a/b/c.

---

## ⏳ المتبقّي (مرتّب بالأولوية)

### ١) إصلاح الموقع العام — عطل بطاقات المشاريع ✅ مُصلَح (2026-07-09)
~~`main.js` يقرأ ثوابت مسطّحة لكن البناء يولّد `RYLIST_DATA` فقط → بطاقات الرئيسية والفلتر معطّلة.~~
**تم الحل** في commit `68f2c6f` "fix(site): emit flat data globals so the public homepage renders": `dataJs.mjs` الآن يولّد `const CONTACT/PROJECTS/NEWS/PARTNERS/STATS` المسطّحة (لـmain.js) **و** `window.RYLIST_DATA` (لـpublic.js).
- **مُتحقَّق حيًّا (2026-07-10):** الرئيسية تعرض ٥ بطاقات مميزة، `projects.html` يعرض ٦ مشاريع نجد والفلتر يعمل، صفر أخطاء console.
- ⚠️ **لا تُعِد فتح هذا العطل** — أي وصف أقدم يقول إنه معطّل فهو قديم. تحقّق دائمًا حيًّا قبل «الإصلاح».

### ٢) الجزء ج — الاستيراد والبروشور
- رفع دفعة عقارات من Excel/CSV (زر «رفع من ملف» موجود كنقطة تركيب معطّلة في `projects.js`).
- رفع بروشور PDF لكل عقار + عرضه بصفحة العقار.

### ٣) صيانة (سريعة ومهمة)
- **تغيير باسورد الأدمن `abc12345`** (لا أداة MCP لـAuth — عبر SQL على `auth.users` أو لوحة Supabase Auth). ⚠️ **ما زال `abc12345`** حتى 2026-07-10 (استُخدم لإطلاق النشر) — يجب تغييره.
- ~~رقم واتساب حقيقي بجدول `contact`~~ ✅ **تم (2026-07-10):** `contact.whatsapp = 966508148860` (والهاتف). أُصلحت أيضًا مسافة بادئة في `email` (`info@rylist.sa`). نُشر وتُحقِّق حيًّا: `wa.me/966508148860` يعمل.
  - **درس تشغيلي:** تعديل محتوى Supabase **لا يظهر حيًّا حتى إعادة النشر** (زر «نشر» → دالة `publish` → Vercel deploy hook). الموقع كان يعرض placeholder فقط لأن آخر بناء سبَق إدخال الرقم.
- تعبئة جدول `social_links` (فاضي).
- فحص جدول «الطلبات» `leads` (فاضي = طبيعي، لا طلبات بعد).
- **ثانوي:** فلتر الحالة في `projects.html` خياراته `available/reserved/sold` لكن NAJD-7 حالته `soon` → لا يمكن عزله بالفلتر (وضبط قيمة غير موجودة يُفرّغ الشبكة). أضف خيار «قريبًا» إن أردت.

---

## ملاحظات تقنية للمحادثة الجديدة (مهمة)
- **البناء المحلي لا يعمل:** `npm run build` يحتاج `SUPABASE_SERVICE_ROLE_KEY` (لم يُعطَ للمساعد أبدًا بقرار المستخدم). التحقّق المحلي = `node --check` للصياغة فقط؛ التحقّق الفعلي = النشر + اختبار بالمتصفّح.
- **نمط النشر:** فرع feature → `node --check` → commit → `merge --no-ff` لـmain → `git push origin main` → Vercel يبني (~دقيقة). **شبكة أمان:** Vercel يُبقي النسخة القديمة لو فشل البناء.
- **اختبار بالمتصفّح:** مهارة gstack `browse` (Chromium بلا واجهة) — سجّل دخول بحساب الأدمن وقُد الواجهة. مثال مؤكَّد: `goto /admin/#projects` → login → افتح نموذج عقار → اضغط أزرار ✨.
- **لا أدوات MCP لـ:** ضبط أسرار Supabase، إنشاء مستخدمي Auth، لوحة Vercel — كلها يدوي/SQL/dashboard.
- **الأمان:** لا مفاتيح سرّية في المتصفّح إطلاقًا (المواصفة §5). `ANTHROPIC_API_KEY` سرّ سيرفر فقط. hook «حارس أسرار» يرفض كتابة مفاتيح حقيقية بالكود.
- **النموذج:** Claude Opus 4.8 = `claude-opus-4-8` (الأحدث). الدالة تناديه بـ`max_tokens:1024`، بلا thinking (توليد بسيط).
- المنهجية المتبعة: superpowers (brainstorming → writing-plans → executing-plans) + systematic-debugging عند الأعطال.
