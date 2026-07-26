# صفحة "من نحن" قابلة للتحرير من لوحة التحكم — تصميم

- **التاريخ:** 2026-07-26
- **الحالة:** معتمد (بانتظار مراجعة السبيك)
- **المقاربة:** A — جدول `about_content` مخصّص يحاكي `home_content`

## المشكلة

صفحة `about.html` منشورة ومربوطة في القائمة على كل الصفحات، لكن نصوصها **ثابتة (static)** — لا تأتي من قاعدة البيانات. قسم "الصفحات" الحالي في لوحة التحكم (جدول `pages`، مفتاح `about`) **لا يؤثر إطلاقًا** على الموقع المباشر، لأن `renderPages` لا يطبّق محتوى `pages` أصلًا. النتيجة: لا توجد طريقة لتحرير محتوى "من نحن" من لوحة التحكم.

## كيف يعمل نظام المحتوى حاليًا (الخلفية)

- سمات `data-cms="key"` تُستهلك **وقت البناء** (لا وقت التشغيل) عبر `scripts/lib/applyContent.mjs`: تراكب نص قاعدة البيانات على أي عنصر يحمل `data-cms`، وإن كانت القيمة فارغة يبقى النص الافتراضي في HTML (احتياط + SEO).
- الصفحة الرئيسية قابلة للتحرير بهذه الطريقة عبر جدول `home_content` (صف واحد `id=1`، عمود `i18n jsonb` يخزّن `{ key:{ar,en,zh} }`).
- `scripts/build.mjs` → `fetchContent()` يجلب المحتوى، ثم `renderPages()` يبني خريطة نصوص `content.text = { ...home.i18n, ...chrome.i18n }` ويطبّقها على كل صفحة.
- ترتيب `localizeHtml`: يبدّل `data-en`/`data-zh` أولًا (للغات غير العربية)، ثم `applyContent` يراكب قيمة قاعدة البيانات لتلك اللغة فقط إن وُجدت — فتبقى الترجمات الافتراضية سليمة لأي لغة لم تُملأ في اللوحة.

## الحل

نطبّق على "من نحن" **نفس** آلية الصفحة الرئيسية.

### 1) قاعدة البيانات — `supabase/migrations/0014_about_content.sql`

نسخة طبق الأصل من نمط `home_content`:

```sql
create table if not exists public.about_content (
  id         int primary key default 1 check (id = 1),
  i18n       jsonb not null default '{}'::jsonb,   -- { about_eyebrow:{ar,en,zh}, ... }
  updated_at timestamptz not null default now()
);
create trigger trg_about_content_updated before update on public.about_content
  for each row execute function public.set_updated_at();

insert into public.about_content (id) values (1) on conflict (id) do nothing;

alter table public.about_content enable row level security;
create policy "about_content read"  on public.about_content for select using (true);
create policy "about_content write" on public.about_content for all
  using (public.is_admin()) with check (public.is_admin());
```

وفي نفس الميجريشن نُزيل إدخال `about` الميّت من قسم "الصفحات":

```sql
delete from public.pages where key = 'about';
alter table public.pages drop constraint pages_key_check;   -- اسم القيد يُتحقّق منه فعليًا
alter table public.pages add  constraint pages_key_check check (key in ('services'));
```

> **يُتحقّق منه أثناء التنفيذ:** الاسم الفعلي لقيد `check` على `pages.key` (قد يكون `pages_key_check`) عبر `list_tables`/فحص المخطط قبل الـ`drop`.

الصف مبذور فارغًا عمدًا: لا تغيير بصري حتى يحرّر المستخدم، والافتراضيات في HTML تبقى تعمل لكل اللغات.

### 2) صفحة `about.html` — إضافة سمات `data-cms`

تُضاف `data-cms="about_*"` لكل عنصر نصّي قابل للتحرير، مع إبقاء النص الحالي كافتراضي (SEO/احتياط). كل المفاتيح مسبوقة بـ`about_` لتفادي التصادم مع مفاتيح الصفحة الرئيسية في خريطة النصوص المشتركة.

خريطة المفاتيح (≈36):

| القسم | المفتاح | العنصر |
|------|---------|--------|
| البانر | `about_eyebrow` | eyebrow "من نحن" |
| | `about_title` | h1 "نساعدك تختار بثقة." |
| | `about_lead` | p.lead |
| القصة | `about_story_eyebrow` | "قصّتنا" |
| | `about_story_head` | h2 |
| | `about_story_p1` | الفقرة ١ |
| | `about_story_p2` | الفقرة ٢ |
| المهمّة/الرؤية | `about_mission_eyebrow` | "المهمّة" |
| | `about_mission_text` | نص المهمّة |
| | `about_vision_eyebrow` | "الرؤية" |
| | `about_vision_text` | نص الرؤية |
| الخطوات | `about_steps_eyebrow` | "كيف تختار معنا" |
| | `about_steps_head` | h2 |
| | `about_step1_title` … `about_step4_title` | عناوين الخطوات ١–٤ |
| | `about_step1_desc` … `about_step4_desc` | أوصاف الخطوات ١–٤ |
| القيم | `about_values_eyebrow` | "قيمنا" |
| | `about_values_head` | h2 |
| | `about_val1_title` … `about_val5_title` | عناوين القيم ١–٥ |
| | `about_val1_desc` … `about_val5_desc` | أوصاف القيم ١–٥ |
| الاقتباس | `about_quote` | p.q |
| CTA | `about_cta_head` | h2 "جاهز تلاقي عقارك؟" |
| | `about_cta_btn` | زر "تواصل معنا" |

> **ملاحظة سلوك:** `applyContent` يستدعي `esc(val)` — فالقيم تُهرّب HTML. الحقول "الغنية" هنا تُطبَّق كنص عادي (نفس سلوك `home_content` تمامًا). لا نغيّر `applyContent`.

### 3) لوحة التحكم — `admin/entities.js`

كيان جديد `about_content` (نفس نمط `home_content`):

```js
{ key:"about_content", label:"صفحة من نحن", table:"about_content", order:"id", single:true, title:"id", fields:[
  {n:"i18n.about_eyebrow",     t:"i18n-text", l:"البانر — العنوان الصغير"},
  {n:"i18n.about_title",       t:"i18n-text", l:"البانر — العنوان"},
  {n:"i18n.about_lead",        t:"i18n-rich", l:"البانر — الوصف"},
  {n:"i18n.about_story_eyebrow", t:"i18n-text", l:"القصة — العنوان الصغير"},
  {n:"i18n.about_story_head",  t:"i18n-text", l:"القصة — العنوان"},
  {n:"i18n.about_story_p1",    t:"i18n-rich", l:"القصة — فقرة ١"},
  {n:"i18n.about_story_p2",    t:"i18n-rich", l:"القصة — فقرة ٢"},
  {n:"i18n.about_mission_eyebrow", t:"i18n-text", l:"المهمّة — العنوان الصغير"},
  {n:"i18n.about_mission_text",t:"i18n-rich", l:"المهمّة — النص"},
  {n:"i18n.about_vision_eyebrow", t:"i18n-text", l:"الرؤية — العنوان الصغير"},
  {n:"i18n.about_vision_text", t:"i18n-rich", l:"الرؤية — النص"},
  {n:"i18n.about_steps_eyebrow", t:"i18n-text", l:"الخطوات — العنوان الصغير"},
  {n:"i18n.about_steps_head",  t:"i18n-text", l:"الخطوات — العنوان"},
  {n:"i18n.about_step1_title", t:"i18n-text", l:"خطوة ١ — العنوان"},
  {n:"i18n.about_step1_desc",  t:"i18n-rich", l:"خطوة ١ — الوصف"},
  {n:"i18n.about_step2_title", t:"i18n-text", l:"خطوة ٢ — العنوان"},
  {n:"i18n.about_step2_desc",  t:"i18n-rich", l:"خطوة ٢ — الوصف"},
  {n:"i18n.about_step3_title", t:"i18n-text", l:"خطوة ٣ — العنوان"},
  {n:"i18n.about_step3_desc",  t:"i18n-rich", l:"خطوة ٣ — الوصف"},
  {n:"i18n.about_step4_title", t:"i18n-text", l:"خطوة ٤ — العنوان"},
  {n:"i18n.about_step4_desc",  t:"i18n-rich", l:"خطوة ٤ — الوصف"},
  {n:"i18n.about_values_eyebrow", t:"i18n-text", l:"القيم — العنوان الصغير"},
  {n:"i18n.about_values_head", t:"i18n-text", l:"القيم — العنوان"},
  {n:"i18n.about_val1_title",  t:"i18n-text", l:"قيمة ١ — العنوان"},
  {n:"i18n.about_val1_desc",   t:"i18n-rich", l:"قيمة ١ — الوصف"},
  {n:"i18n.about_val2_title",  t:"i18n-text", l:"قيمة ٢ — العنوان"},
  {n:"i18n.about_val2_desc",   t:"i18n-rich", l:"قيمة ٢ — الوصف"},
  {n:"i18n.about_val3_title",  t:"i18n-text", l:"قيمة ٣ — العنوان"},
  {n:"i18n.about_val3_desc",   t:"i18n-rich", l:"قيمة ٣ — الوصف"},
  {n:"i18n.about_val4_title",  t:"i18n-text", l:"قيمة ٤ — العنوان"},
  {n:"i18n.about_val4_desc",   t:"i18n-rich", l:"قيمة ٤ — الوصف"},
  {n:"i18n.about_val5_title",  t:"i18n-text", l:"قيمة ٥ — العنوان"},
  {n:"i18n.about_val5_desc",   t:"i18n-rich", l:"قيمة ٥ — الوصف"},
  {n:"i18n.about_quote",       t:"i18n-rich", l:"الاقتباس"},
  {n:"i18n.about_cta_head",    t:"i18n-text", l:"شريط CTA — العنوان"},
  {n:"i18n.about_cta_btn",     t:"i18n-text", l:"شريط CTA — الزر"},
]},
```

وتُضاف `about_content: "pages"` إلى خريطة `iconFor` في `admin/app.js`. لا حاجة لأي كود لوحة تحكم جديد — يُعرض عبر `renderList` (المحرّر أحادي الصف الموجود).

### 4) ربط البناء

- `scripts/lib/fetchContent.mjs`: أضف `about` إلى استدعاءات `single(...)` وإلى الكائن المُعاد: `single("about_content")` → `about`.
- `scripts/lib/renderPages.mjs`: ادمج `...(c.about?.i18n || {})` في `content.text`.

### 5) الاختبار

توسيع `scripts/lib/renderPages.test.mjs`: التأكيد أن قيمة `about_content.i18n.about_title` تُراكب على `about.html` المبنية، وأن غياب القيمة يُبقي النص الافتراضي.

## الملفات المتأثّرة

| ملف | التغيير |
|-----|---------|
| `supabase/migrations/0014_about_content.sql` | جديد — جدول + RLS + بذرة + تنظيف `pages` |
| `about.html` | إضافة ~36 سمة `data-cms` |
| `admin/entities.js` | كيان `about_content` جديد |
| `admin/app.js` | `iconFor.about_content = "pages"` |
| `scripts/lib/fetchContent.mjs` | جلب `about_content` |
| `scripts/lib/renderPages.mjs` | دمج `about.i18n` في خريطة النصوص |
| `scripts/lib/renderPages.test.mjs` | اختبار مراكبة "من نحن" |

## خارج النطاق

- جعل صفحة "الخدمات" (services) قابلة للتحرير — نفس النمط لاحقًا عند الحاجة.
- دعم HTML غني فعلي داخل حقول المراكبة (السلوك الحالي: نص مُهرّب، متوافق مع `home_content`).
- تعديل تصميم الصفحة أو أقسامها.

## المخاطر

- **تصادم المفاتيح** في خريطة النصوص المشتركة → مُخفَّف ببادئة `about_`.
- **اسم قيد `pages.key`** قد يختلف → يُتحقّق منه قبل `drop constraint`.
- **الميجريشن على الإنتاج مباشرة** (بيئة remote) → يُطبّق عبر `apply_migration` بعد المراجعة.
