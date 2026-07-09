# RYLIST — موقع شركة التسويق العقاري

موقع تعريفي احترافي لشركة **RYLIST (رايليست) العقارية**، ثنائي اللغة (عربي RTL افتراضي + إنجليزي LTR)،
مبني على **هوية Rylist البصرية** (حبر + عاجي + ذهبي شامبين، شعار «خط القمّة»، خطوط Cormorant Garamond /
Hanken Grotesk / Amiri / IBM Plex Sans Arabic). البنية والمحتوى على نمط شركة تسويق عقاري (مشاريع،
مطوّرون، خدمات، إحصائيات، شركاء نجاح، أخبار).

## الستاك

HTML/CSS/JS ثابت — **بدون أي أداة بناء (build) ولا إطار عمل**. يعمل بفتح الملف مباشرة.

```
rylist/
├─ index.html · projects.html · services.html · about.html · news.html · contact.html
├─ assets/css/styles.css        # التوكنز + المكوّنات + responsive + RTL/LTR
├─ assets/js/
│  ├─ data.js                   # المشاريع/المطوّرون/الإحصائيات/الشركاء/الأخبار (عربي+إنجليزي)
│  ├─ i18n.js                   # قاموس الترجمة + تبديل اللغة + الحفظ في localStorage
│  └─ main.js                   # رسم البطاقات، الفلترة، قائمة الجوال، عدّاد الأرقام، النموذج
├─ favicon.svg · robots.txt · sitemap.xml
└─ docs/BRD-rylist-website.md
```

## التشغيل محليًا

- **الأسهل:** افتح `index.html` بالمتصفّح مباشرة.
- **أفضل (خادم محلي، يجعل الروابط النسبية تعمل بلا استثناءات):**

```powershell
npx serve .
# أو
python -m http.server 8000
```

ثم افتح `http://localhost:8000`.

## النشر

موقع ثابت → يُنشر على أي استضافة بلا أمر build:

- **Netlify / Vercel:** اسحب المجلد أو اربط المستودع. Build command: (فارغ). Publish directory: `.` (الجذر).
- **GitHub Pages:** ادفع المجلد وفعّل Pages من فرع `main` / المجلد الجذر.

## قبل الإطلاق (استبدل الـplaceholders)

| المكان | القيمة المؤقتة | استبدلها بـ |
|---|---|---|
| `assets/js/main.js` (أعلى الملف) | `CONTACT.whatsapp = "9665XXXXXXXX"` | رقم واتساب الحقيقي (صيغة دولية بلا +) |
| `assets/js/main.js` | `CONTACT.email = "hello@rylist.sa"` | البريد الرسمي |
| `assets/js/data.js` | المشاريع/الأرقام/الأخبار التجريبية | بياناتك الحقيقية |
| `assets/img/` وروابط Unsplash | صور معمارية مؤقتة | صور مشاريعك (بأسلوب مكتوم دافئ) |
| `contact.html` | خريطة Google (إحداثيات مؤقتة) | موقع مكتبك |

## اللغة

الافتراضي عربي (RTL). زر «EN / ع» في الشريط العلوي يبدّل اللغة، يقلب الاتجاه والخطوط، ويحفظ الاختيار.
