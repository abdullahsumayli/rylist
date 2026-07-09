# تصميم — المساعد الذكي للتحرير (الجزء ب / المرحلة ٢)

> **التاريخ:** 2026-07-09
> **الحالة:** معتمد (المستخدم وافق، ومفتاح Anthropic جاهز).
> **المرجع:** [admin-cms-design §2 المرحلة ٢](2026-07-09-rylist-admin-cms-design.md) · [Part A](2026-07-09-rylist-admin-redesign-partA-design.md)

## ٠) الهدف
تفعيل المرحلة ٢ من الرؤية: أزرار **✨** (توليد / تحسين / ترجمة / عنوان‑SEO / أفكار) جنب كل حقل نص في اللوحة، عبر **Claude Opus 4.8**. نقاط التركيب (`.aibar`) بُنيت في الجزء أ — هذا الجزء يملؤها.

## ١) المعمارية والأمان
```
لوحة الأدمن (متصفّح)                     Supabase Edge Function `ai-assist`         Anthropic API
  ai.js: زر ✨  ──invoke(session JWT)──▶  is_admin() gate → يبني prompt ─HTTPS─▶  claude-opus-4-8
                 ◀───── { result } ──────  يرجّع النص                    ◀──────  نص
```
- **المفتاح `ANTHROPIC_API_KEY` سرّ في Supabase فقط** — لا يلمس المتصفّح إطلاقًا (نفس مبدأ المواصفة §5).
- الدالة **محمية بـ`is_admin()`** ومطلوب JWT صالح (`verify_jwt: true`) — مثل `publish`.
- CORS يعكس ترويسات الطلب (نفس إصلاح `publish` الأخير).
- **نداء HTTPS مباشر** لـ`https://api.anthropic.com/v1/messages` (بدل SDK) — دالة خفيفة، نداء واحد قصير غير متدفّق، `max_tokens: 1024`، بلا `thinking` (توليد نص بسيط = أسرع/أرخص).

## ٢) عقد الدالة (request/response)
**Request body:**
```json
{ "action":"generate|improve|translate|seo|ideas",
  "entity":"projects|news|pages", "field":"description|title|excerpt|body",
  "locale":"ar", "targetLocales":["en","zh"], "text":"النص الحالي",
  "context":{ "code":"RY-1042","city":"riyadh","type":"villa","status":"available",
              "priceMin":2400000,"priceMax":3900000,"bedsMin":4,"bedsMax":6,"area":"320–520",
              "title":"قمم الملقا","district":"الملقا" } }
```
**Response:** `{ "result": "..." }` لكل الأفعال، عدا `translate` → `{ "translations": { "en":"...", "zh":"..." } }`.
**أخطاء:** `{ "error": "..." }` بـstatus مناسب (401 غير أدمن، 500 مفتاح ناقص، 502 فشل Anthropic).

## ٣) الأفعال (prompts)
- **generate** — يكتب المحتوى للـ`locale` من `context` (كاتب تسويق عقاري RYLIST، نبرة راقية، بلا مبالغة، ٣٠–٦٠ كلمة للوصف). يملأ الحقل الحالي.
- **improve** — يهذّب `text` بنفس اللغة. يستبدل الحقل الحالي.
- **translate** — يترجم `text` (من `locale`) لكل لغة في `targetLocales` (ترجمة تسويقية طبيعية) — نداء متوازٍ لكل لغة. يملأ تبويبات اللغات.
- **seo** — يقترح عنوانًا محسّنًا للسيو للـ`locale`. يملأ الحقل الحالي.
- **ideas** — ٣–٥ نقاط بيع. تُعرض بلوحة صغيرة أسفل الشريط (لا تستبدل).

## ٤) الواجهة
- **`admin/ai.js`** يصدّر `renderAIBar(aibar, { field, ent, draft, tabs })`. يرسم الأزرار بستايل `.aibtn` (الموجود في admin.css)، ويدير الحالة (busy)، والنداء، وتعبئة النتيجة.
- **`admin/fields.js`** (تعديل): `localeTabs` يرجّع `{ el, setText(loc,text), current() }` بدل عنصر فقط؛ ولكل حقل i18n يُنادى `renderAIBar` بحاوية `.aibar` مع المقابض.
- **`admin/app.js`**: لا تغيير (ai.js يُستورد من fields.js).

## ٥) معايير القبول
- **AC-B.1** الدالة `ai-assist` منشورة، محمية بـ`is_admin()`، وتنجح بمفتاح Anthropic صحيح.
- **AC-B.2** أزرار ✨ تظهر جنب كل حقل نص i18n في نماذج اللوحة.
- **AC-B.3** «توليد» يكتب وصفًا عربيًا واقعيًا من بيانات العقار، ويظهر في الحقل.
- **AC-B.4** «ترجمة» يملأ تبويبات EN/中 من النص العربي.
- **AC-B.5** «تحسين»، «عنوان‑SEO»، «أفكار» تعمل.
- **AC-B.6** المفتاح لا ينكشف بالمتصفّح؛ غير الأدمن يُرفض (401).
- **AC-B.7** لو المفتاح ناقص، رسالة خطأ ودّية بدل انهيار.

## ٦) خارج النطاق
- طيّار المدونة الآلي (المرحلة ٤). المستشار العقاري (المرحلة ٣). بثّ متدفّق للنص (streaming) — لاحقًا لو احتجنا.

## ٧) الخطوات (خطة مضغوطة)
1. `supabase/functions/ai-assist/index.ts` → نشر عبر MCP.
2. `admin/ai.js` جديد.
3. تعديل `admin/fields.js` (localeTabs يرجّع مقابض + نداء renderAIBar).
4. نشر اللوحة (merge/deploy) + المستخدم يضيف السرّ.
5. اختبار حيّ بالمتصفّح.
