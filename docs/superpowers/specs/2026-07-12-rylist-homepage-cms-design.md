# RYLIST — تحكّم الأدمن الكامل بالصفحة الرئيسية (Homepage CMS)

> التاريخ: 2026-07-12 · الحالة: تصميم معتمد · النطاق: نص + صور + هوية (خطوط/ألوان)

## المشكلة

نصوص الصفحة الرئيسية (والهيدر/الفوتر المشتركين) مكتوبة يدوياً داخل ملفات HTML الثابتة
(عربي في نص العنصر، إنجليزي/صيني في `data-en`/`data-zh`). الأدمن لا يملك أي وسيلة لتعديلها؛
كل تغيير نصّي يتطلّب تحرير الكود. المطلوب: يتحكّم الأدمن من لوحة التحكم في كل نص وصورة
وهوية الصفحة الرئيسية، بلا لمس الكود، وبنفس تدفّق النشر الحالي.

## النطاق المعتمد

- **داخل النطاق:** كل نصوص جسم الصفحة الرئيسية (الهيرو حتى شريط CTA) بالثلاث لغات ·
  نصوص الهيدر/الفوتر المشتركة (تُطبَّق على كل الصفحات) · صورة خلفية الهيرو ·
  هوية عبر **مجموعات جاهزة منتقاة** (خط + لون هوية).
- **خارج النطاق (YAGNI):** إضافة/حذف/إعادة ترتيب الأقسام (منشئ صفحات) · حرية اختيار أي خط/لون ·
  معاينة حيّة قبل النشر · تعديل صفحات أخرى (المشاريع/الخدمات...) عدا الهيدر/الفوتر المشتركين.

## المقاربة المعتمدة: تراكب المحتوى على HTML الحالي

يبقى النص المكتوب في HTML **قيمة افتراضية**؛ نُعلّم العناصر القابلة للتعديل بسِمة مفتاح،
وعند البناء نستبدل نصّها بقيمة قاعدة البيانات إن وُجدت. هذا يحافظ على SEO والاحتياط،
ويعيد استخدام نظام i18n والنشر ونماذج الحقول الموجودة، وهو الأقل خطراً.

(المقاربات المرفوضة: قوالب مدفوعة كلياً من القاعدة — إعادة كتابة كبيرة تفقد احتياط SEO؛
حقن وقت التشغيل بالمتصفح — ومضة نص وأسوأ لـ SEO ويتعارض مع صفحات اللغات الثابتة.)

## نموذج البيانات

ثلاثة جداول جديدة، صف واحد لكل منها (id=1)، بنفس نمط `i18n` JSONB و RLS المستخدَم في
`contact` (قراءة عامة anon · كتابة للأدمن فقط عبر `is_admin()`). هجرة جديدة `0013_home_content.sql`
تُنشئ الجداول + السياسات + محفّز `set_updated_at` + صف بذرة id=1 لكل جدول.

### `home_content` (id int pk = 1)
- `hero_image_url text` — خلفية الهيرو.
- `i18n jsonb` — كل نصوص جسم الرئيسية، كل مفتاح يحمل `{ ar, en, zh }`. المفاتيح:
  - الهيرو: `hero_title`, `hero_lead`, `hero_cta1`, `hero_cta2`
  - البحث: `search_eyebrow`
  - الخدمات: `svc_eyebrow`, `svc_head`, `svc1_title`, `svc1_desc`, `svc2_title`, `svc2_desc`, `svc3_title`, `svc3_desc`
  - المشاريع المميّزة: `feat_eyebrow`, `feat_head`, `feat_link`
  - الشركاء: `partners_eyebrow`
  - لماذا rylist: `why_eyebrow`, `why_head`, `why_lead`, `why_cta`, `why1_title`, `why1_desc`, `why2_title`, `why2_desc`, `why3_title`, `why3_desc`
  - شريط CTA: `cta_head`, `cta_lead`, `cta_primary`, `cta_wa`

### `site_chrome` (id int pk = 1)
- `i18n jsonb` — نصوص الهيدر/الفوتر المشتركة:
  - الهيدر: `nav_home`, `nav_projects`, `nav_services`, `nav_about`, `nav_news`, `nav_contact`, `nav_cta`, `topbar_city`
  - الفوتر: `footer_tag`, `footer_explore_head`, `footer_contact_head`, `footer_bottom`, `footer_rights`

### `site_theme` (id int pk = 1)
- `font_preset text` — معرّف مجموعة الخط (افتراضي `classic`).
- `accent_preset text` — معرّف لون الهوية (افتراضي `gold`).

## ربط HTML بالبناء

### تعليم العناصر
- كل عنصر نصّي قابل للتعديل في [index.html](../../../index.html) يأخذ `data-cms="<key>"`
  حيث `<key>` أحد مفاتيح `home_content.i18n` (مثال: `data-cms="hero_title"`).
- الهيدر/الفوتر **مكرّران حرفياً في كل ملف صفحة** (لا include مشترك)، فتعليمهما بمفاتيح
  `site_chrome` يجب أن يُطبَّق في **كل** ملفات الصفحات الستّة (index/projects/services/about/news/contact)
  حتى تنعكس التعديلات على الموقع كامل. (الأنظف مستقبلاً: استخراج هيدر/فوتر مشترك، لكن خارج نطاق هذه الخطة.)
- خلفية الهيرو تأخذ `data-cms-img="hero"` (تربط `home_content.hero_image_url`) — في index.html فقط.
- النص الحالي و`data-en`/`data-zh` يبقيان بلا حذف (احتياط + SEO).

### دالة التراكب `applyContent`
- ملف جديد `scripts/lib/applyContent.mjs` يصدّر `applyContent(root, maps, locale)`:
  - `maps = { home: {key→{ar,en,zh}}, chrome: {key→{ar,en,zh}} }`.
  - لكل عنصر `[data-cms]`: خُذ القيمة `maps[...][key][locale]`؛ إن كانت نصاً غير فارغ،
    استبدل محتوى العنصر بها (`set_content`)، وإلا اترك الافتراضي.
  - لكل عنصر `[data-cms-img]`: إن وُجد `hero_image_url` غير فارغ، اضبط
    `style` background-image عليه.
- تُستدعى داخل `localizeHtml` في [renderPages.mjs](../../../scripts/lib/renderPages.mjs)
  **بعد** تبديل `data-<locale>` (فالقاعدة تتجاوز الافتراضي لكل لغة). آمنة على كل الصفحات:
  عنصر بلا مفتاح مطابق يبقى كما هو.

### حقن المظهر
- ملف جديد `scripts/lib/theme.mjs` يصدّر خرائط المجموعات (المصدر الوحيد لقيم المظهر).
- في `localizeHtml`: اقرأ `site_theme`، حوّل `font_preset`→(رابط Google Fonts + قيم متغيّرات الخط)
  و `accent_preset`→(قيم متغيّرات اللون)، وأدرج في `<head>`:
  - استبدال/إضافة رابط الخط.
  - وسم `<style>` يضبط متغيّرات CSS الجذرية (`--font-display`, `--font-sans`, `--font-ar`,
    `--accent`, `--accent-deep`, `--accent-soft`, `--on-accent`).
- غير مضبوط ⇒ استخدم الافتراضي `classic`/`gold` (= التصميم الحالي).
- **شرط:** [styles.css](../../../assets/css/styles.css) يجب أن يقرأ هذه المتغيّرات. جزء من الخطة:
  تحويل تعريفات الخط/اللون الثابتة الحالية إلى متغيّرات CSS بقيم افتراضية مطابقة للحالي.

### جلب المحتوى
- [fetchContent.mjs](../../../scripts/lib/fetchContent.mjs) يجلب أيضاً `home_content` و `site_chrome`
  و `site_theme` (كلها صف id=1) ويمرّرها ضمن `c`.

## واجهة الأدمن

- ثلاثة كيانات جديدة تُضاف إلى مصفوفة `ENTITIES` في [entities.js](../../../admin/entities.js)،
  فتظهر تلقائياً في قائمة الشل (`buildSections` في [app.js](../../../admin/app.js)) بنماذج
  جاهزة عبر [list.js](../../../admin/list.js) + [fields.js](../../../admin/fields.js) — بلا كود واجهة جديد:
  1. **«الرئيسية»** → `home_content` (`single:true`): حقول `i18n-text`/`i18n-rich` لكل مفتاح +
     حقل `image` لخلفية الهيرو. نموذج واحد طويل (مقبول؛ يمكن تقسيمه لاحقاً إن لزم).
  2. **«الهيدر والفوتر»** → `site_chrome` (`single:true`): حقول `i18n-text` لنصوص القائمة والفوتر.
  3. **«المظهر»** → `site_theme` (`single:true`): حقلا `select` (`font_preset`, `accent_preset`)
     بخيارات = معرّفات المجموعات، مع `hint` يشرح كل خيار.
- إضافة أيقونات للكيانات الثلاثة في خريطة `iconFor` في [app.js](../../../admin/app.js).
- الصور تستخدم نوع الحقل `image` الحالي (رفع إلى تخزين Supabase).

## المجموعات الجاهزة (`scripts/lib/theme.mjs`)

المصدر الوحيد لقيم المظهر؛ يعكس الأدمن معرّفاتها وتسمياتها في `entities.js` (تكرار صغير مقبول،
يُوثّق تعليقاً بأنهما يجب أن يتطابقا).

### خطوط (٤–٥ مجموعات، كلها تدعم عربي RTL)
- `classic` — «الترف الكلاسيكي» (الحالي: Cormorant Garamond + IBM Plex Sans Arabic)
- `modern` — «عصري» (Hanken Grotesk + IBM Plex Sans Arabic)
- `elegant` — «أنيق» (Playfair Display + Tajawal)
- `simple` — «بسيط» (Inter + Cairo)

كل مجموعة: `{ id, label, href (Google Fonts), vars: { '--font-display', '--font-sans', '--font-ar' } }`.

### ألوان الهوية (٤–٥)
- `gold` — ذهبي (الحالي) · `green` — أخضر عميق · `navy` — كحلي · `charcoal` — فحمي · `burgundy` — نبيذي

كل لون: `{ id, label, vars: { '--accent', '--accent-deep', '--accent-soft', '--on-accent' } }`.

## النشر والاحتياط والحواف

- **النشر:** نفس زر «نشر» ← دالة `publish` ← إعادة بناء Vercel. لا مسار جديد.
- **الاحتياط:** مفتاح فارغ/غائب ⇒ يبقى النص الافتراضي؛ مظهر غير مضبوط ⇒ التصميم الحالي.
  الموقع يعمل حتى لو الجداول الجديدة فاضية.
- **SEO:** النص الافتراضي يبقى في المصدر؛ صفحات اللغات و hreflang بلا تغيير.
- **الهيدر/الفوتر:** التراكب يعمل على كل صفحة، فتغيير القائمة/الفوتر ينعكس على الموقع كامل.

## الاختبار

- وحدة اختبار لـ`applyContent` (على غرار [renderProject.test.mjs](../../../scripts/lib/renderProject.test.mjs)):
  - عنصر بمفتاح موجود + قيمة غير فارغة ⇒ يُستبدل النص.
  - مفتاح غائب أو قيمة فارغة ⇒ يبقى النص الافتراضي.
  - `data-cms-img` مع/بدون `hero_image_url`.
- تحقّق بناء يدوي: نشر بقيم مخصّصة ثم فحص `dist/index.html` و`dist/en/index.html`.

## معايير القبول

- **AC-1** الجداول الثلاثة موجودة مع RLS (قراءة عامة، كتابة أدمن) وصفوف بذرة id=1.
- **AC-2** الأدمن يعدّل أي نص في جسم الرئيسية بالثلاث لغات، وبعد النشر يظهر التغيير مباشرةً.
- **AC-3** الأدمن يعدّل نصوص الهيدر/الفوتر، فتنعكس على كل صفحات الموقع.
- **AC-4** الأدمن يرفع/يبدّل صورة خلفية الهيرو.
- **AC-5** الأدمن يختار مجموعة خط ولون هوية، فيتغيّر مظهر الموقع كامل بعد النشر.
- **AC-6** ترك أي حقل فارغاً يُبقي النص/التصميم الافتراضي الحالي — لا كسر.
- **AC-7** SEO محفوظ: النص الافتراضي في مصدر كل صفحة لغة، و hreflang سليم.

## ملفات متأثّرة

- جديد: `supabase/migrations/0013_home_content.sql` · `scripts/lib/applyContent.mjs` ·
  `scripts/lib/applyContent.test.mjs` · `scripts/lib/theme.mjs`
- تعديل: `scripts/lib/renderPages.mjs` · `scripts/lib/fetchContent.mjs` · `assets/css/styles.css`
  (خط/لون ← متغيّرات) · `index.html` بسِمات `data-cms` لجسم الرئيسية + `data-cms-img` للهيرو ·
  الهيدر/الفوتر بسِمات `data-cms` في كل الصفحات الستّة
  (`index/projects/services/about/news/contact.html`) · `admin/entities.js` · `admin/app.js` (iconFor)
