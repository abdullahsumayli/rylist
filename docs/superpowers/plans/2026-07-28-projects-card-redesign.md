# خطة تنفيذ: بطاقة المشروع وشريط الفلاتر بأسلوب Mada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تحويل بطاقة المشروع من «صورة فوق + صندوق نص تحت» إلى بطاقة كاملة الصورة بتراكب على طراز Mada Properties، واستبدال قوائم `<select>` بتبويبات دائرية — بهوية رايليست البصرية بالكامل.

**Architecture:** التغيير كله في ثلاثة ملفات: `assets/js/main.js` (دالة البطاقة + منطق الفلاتر)، `assets/css/styles.css` (قسم جديد يُلحق في نهاية الملف)، و`projects.html` (ترميز شريط الفلاتر). صفحة `index.html` لا تُمسّ — ترث البطاقة الجديدة لأن `renderFeatured()` تستدعي `projectCard()` نفسها.

**Tech Stack:** HTML/CSS/JS خام بلا أدوات بناء واجهة. `main.js` نمط IIFE بـ ES5 (`var`، تسلسل نصوص) — التزم به. البناء `node scripts/build.mjs` يولّد `assets/js/data.js` من Supabase.

**المواصفة المرجعية:** [`docs/superpowers/specs/2026-07-28-projects-card-redesign-design.md`](../specs/2026-07-28-projects-card-redesign-design.md)

---

## ملاحظة على التحقق — اقرأها قبل البدء

`assets/js/main.js` ملف IIFE للمتصفّح لا وحدة ES، فلا يمكن استيراده في `node --test`.
لا يوجد في المستودع أي اختبار وحدة لهذا الملف (٥٤٠ سطرًا) — إدخال إعادة هيكلة لتقسيمه
إلى وحدات خارج نطاق هذا العمل. **التحقق هنا بصري وسلوكي عبر المتصفّح**، وكل مَهمّة تحدّد
ما يُفحص بالضبط. لا تدّعِ نجاح مَهمّة دون تنفيذ خطوة الفحص فعليًا ورؤية النتيجة.

**معاينة محليًا:**

```bash
python -m http.server 8000
# ثم افتح http://localhost:8000/projects.html
```

الصفحة تقرأ `assets/js/data.js` الملتزَم في git — وفيه **٩ مشاريع بذور** بخمس مدن،
وحالات `available`/`reserved`/`sold`، ونِسَب مبيع غير صفرية. هذا **أفضل** للفحص البصري
من البيانات الحيّة (٦ مشاريع، كلها `available` و`sold = 0`)، لأنه يمرّن الحالات كلها.
لا تشغّل `npm run build` — يحتاج اعتماديات Supabase ويستبدل `data.js` ببيانات الإنتاج.

---

## بنية الملفات

| الملف | المسؤولية بعد التغيير |
|---|---|
| `assets/js/main.js` | `chipsFor()` و`fmtPriceFrom()` جديدتان؛ `projectCard()` معاد كتابتها؛ `currentFilters()` تقرأ من الأزرار؛ `renderFilterRows()`/`setFilter()`/`syncUrl()`/`initFilterTabs()` جديدة |
| `assets/css/styles.css` | قسم ١٩ جديد في **نهاية** الملف (بعد طبقة الأسطح الناعمة) — لا يُعدَّل القسم ١٢ إلا بالحذف في المَهمّة ٦ |
| `projects.html` | `.filters` (الأسطر ٦٤–٨٨) ← `.filterbar` بثلاثة صفوف تبويبات |

---

## Task 1: أساس CSS — التوكن وهيكل البطاقة

**Files:**
- Modify: `assets/css/styles.css` (إلحاق في نهاية الملف، بعد السطر ١٢٩٢)

- [ ] **Step 1: تأكّد أن نهاية الملف هي المكان الصحيح**

Run:
```bash
tail -5 assets/css/styles.css && wc -l < assets/css/styles.css
```

Expected: آخر قاعدة تخصّ `.faq` أو ما بعدها، والعدد ١٢٩٢ تقريبًا. المهم أن الإلحاق يجي
**بعد** كتلة الأسطح الناعمة (التي تبدأ حوالي السطر ٩٥٣) — وإلا غلبت قواعدها الجديدَ.

- [ ] **Step 2: ألحِق قسم البطاقة**

أضف في نهاية `assets/css/styles.css`:

```css
/* ==========================================================================
   19. بطاقة المشروع — صورة كاملة بتراكب (بنية Mada بهوية رايليست)
   تُبنى فوق طبقة الأسطح الناعمة أعلاه: الحشوة ١٢px والإطار الغائر يبقيان،
   والجديد يملأ داخلهما بدل الجسم الأبيض القديم.
   ========================================================================== */

/* حرِج: لا تستعمل var(--ink) هنا. طبقة الثيم تعيد تعريفه إلى var(--fg)، وقيمته
   في الوضع الداكن #ece6d8 — أي فاتح. التدرّج المبني عليه ينقلب فاتحًا ويُخفي
   النص الأبيض. هذا التوكن مستقل ولا يُعاد تعريفه في أي ثيم. */
:root { --card-scrim: 23 20 15; }

/* البطاقة صارت <a> — تُبطَل زخرفة الرابط وتُورَّث الألوان */
a.project-card { display: block; text-decoration: none; color: inherit; }
.project-card { --pc-pad: 10px; position: relative; }

.project-card__media { position: relative; aspect-ratio: 4 / 5; overflow: hidden; }
.project-card__media img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  /* أُزيل grayscale(.2) saturate(.85) — كان يبهت الصور المعمارية، والتدرّج
     يوفّر التباين المطلوب بلا تشويه الألوان */
  filter: none;
  transition: transform .5s ease;
}
.project-card:hover .project-card__media img { transform: scale(1.04); }

/* طبقات التراكب محاذاة لحافة الصورة، لا لحافة البطاقة — من هنا --pc-pad */
.pcard__scrim {
  position: absolute; inset: var(--pc-pad); border-radius: 9px; pointer-events: none;
  background: linear-gradient(
    to top,
    rgb(var(--card-scrim) / .92)  0%,
    rgb(var(--card-scrim) / .78) 28%,
    rgb(var(--card-scrim) / 0)   62%
  );
}
.pcard__top, .pcard__bottom {
  position: absolute; inset-inline: var(--pc-pad);
  padding-inline: 12px; pointer-events: none;
}
.pcard__top {
  inset-block-start: calc(var(--pc-pad) + 10px);
  display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-2);
}
.pcard__bottom { inset-block-end: calc(var(--pc-pad) + 12px); }
```

- [ ] **Step 3: افحص بصريًا**

شغّل `python -m http.server 8000` وافتح `http://localhost:8000/projects.html`.

Expected: البطاقات صارت طويلة (٤:٥) والصورة تملأها، وفيه تدرّج داكن أسفل كل صورة.
النص القديم (العنوان والسعر) لسّه في صندوق تحت الصورة — طبيعي، المَهمّة ٢ تنقله للتراكب.

- [ ] **Step 4: التزم**

```bash
git add assets/css/styles.css
git commit -m "feat(cards): أساس البطاقة كاملة الصورة + توكن التدرّج المستقل"
```

---

## Task 2: أيقونات وشرائح ودالة السعر

**Files:**
- Modify: `assets/js/main.js` (بعد `localeDate`، قبل `projectCard` — حوالي السطر ٦٣)

- [ ] **Step 1: أضف الأيقونات ونصوص الواجهة**

في `assets/js/main.js`، أضف داخل جدول `T` (حوالي السطر ٣١، بعد المفتاح `count`):

```js
    count: { ar: "مشروع", en: "projects", zh: "个项目" },
    allLabel: { ar: "الكل", en: "All", zh: "全部" }
```

> انتبه للفاصلة: `count` كان آخر مفتاح بلا فاصلة — أضف الفاصلة بعده.

ثم أضف قبل `function projectCard(p)` مباشرة (حوالي السطر ٦٤):

```js
  /* ----- أيقونات البطاقة (سطرية، بلا طلبات شبكة) ----- */
  var ICON_PIN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var ICON_BED = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 18V7m0 6h18v5M7 11a2 2 0 1 0 0-.01M11 13h10V9a2 2 0 0 0-2-2h-8z"/></svg>';
  var ICON_AREA = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 4v16M4 9h16"/></svg>';
```

- [ ] **Step 2: أضف `chipsFor` و`fmtPriceFrom`**

بعد الأيقونات مباشرة:

```js
  /* شرائح البطاقة — كل شريحة تُحذف إذا كان حقلها فارغًا (لا «—») */
  function chipsFor(p) {
    var out = [];
    var stKey = (p.status === "sold" || p.status === "reserved" || p.status === "soon") ? p.status : "available";
    out.push({ cls: "pcard__chip--" + stKey, icon: "", text: t(stKey) });

    var type = L(p.typeAr, p.typeEn, p.typeZh);
    if (type) out.push({ cls: "", icon: "", text: type });

    if (p.bedsMax > 0) {
      var beds = p.bedsMin === p.bedsMax ? String(p.bedsMin) : p.bedsMin + "–" + p.bedsMax;
      out.push({ cls: "", icon: ICON_BED, text: beds + " " + t("beds") });
    }
    if (p.area) out.push({ cls: "", icon: ICON_AREA, text: p.area + " " + t("area") });
    return out;
  }

  /* السعر على البطاقة = الحدّ الأدنى فقط. المدى الكامل يلتفّ سطرين داخل التراكب
     الضيّق على الجوّال؛ المدى يبقى معروضًا في صفحة تفاصيل المشروع.
     ترتيب الكلمات يختلف بين اللغات («يبدأ من X» مقابل «X 起») فلا يصلح مفتاح T واحد. */
  function fmtPriceFrom(min, max) {
    var lo = min || max;
    if (!lo) return t("priceOnRequest");
    var n = Number(lo).toLocaleString("en-US");
    return L("يبدأ من " + n + " ريال", "From SAR " + n, n + " 里亚尔起");
  }
```

- [ ] **Step 3: تحقّق أنه لا يوجد خطأ صياغة**

Run:
```bash
node --check assets/js/main.js
```

Expected: لا مخرجات (نجاح). أي خطأ صياغة يظهر برقم السطر.

- [ ] **Step 4: التزم**

```bash
git add assets/js/main.js
git commit -m "feat(cards): دوال الشرائح والسعر والأيقونات السطرية"
```

---

## Task 3: إعادة كتابة `projectCard`

**Files:**
- Modify: `assets/js/main.js:65-102` (جسم `projectCard` كاملًا)

- [ ] **Step 1: استبدل الدالة**

احذف `function projectCard(p) { ... }` كاملة (من `/* ----- بطاقة مشروع ----- */`
حتى نهاية الدالة) وضع مكانها:

```js
  /* ----- بطاقة مشروع: صورة كاملة + تراكب ----- */
  function projectCard(p) {
    var title = L(p.titleAr, p.titleEn, p.titleZh);
    var city = L(p.cityAr, p.cityEn, p.cityZh);
    var district = L(p.districtAr, p.districtEn, p.districtZh);

    var chips = chipsFor(p).map(function (c) {
      return '<span class="pcard__chip ' + c.cls + '">' + c.icon + '<span>' + esc(c.text) + '</span></span>';
    }).join("");

    var soldHtml = p.sold
      ? '<div class="pcard__sold"><span class="pcard__sold-fill" style="width:' + Number(p.sold) + '%"></span>' +
        '<span class="pcard__sold-label">' + t("soldPct") + " " + Number(p.sold) + '%</span></div>'
      : "";

    return '' +
      '<a class="project-card" href="projects/' + p.code + '.html">' +
        '<div class="project-card__media">' +
          '<img loading="lazy" src="' + esc(p.img) + '" alt="' + esc(title) + '">' +
          '<span class="pcard__scrim" aria-hidden="true"></span>' +
          '<div class="pcard__top">' +
            '<div class="pcard__chips">' + chips + '</div>' +
            (p.code ? '<span class="pcard__code">' + esc(p.code) + '</span>' : '') +
          '</div>' +
          '<div class="pcard__bottom">' +
            '<div class="pcard__head">' +
              '<h3 class="pcard__title">' + esc(title) + '</h3>' +
              '<span class="pcard__go" aria-hidden="true">' + L("←", "→", "→") + '</span>' +
            '</div>' +
            '<div class="pcard__loc">' + ICON_PIN + '<span>' + esc(district) + L("، ", ", ", "，") + esc(city) + '</span></div>' +
            '<div class="pcard__rule"></div>' +
            '<div class="pcard__price">' + esc(fmtPriceFrom(p.priceMin, p.priceMax)) + '</div>' +
            soldHtml +
          '</div>' +
        '</div>' +
      '</a>';
  }
```

> `p.code` يدخل الرابط بلا ترميز — مقصود ومطابق للسلوك السابق، لأن `scripts/lib/projectPages.mjs`
> يولّد أسماء الملفات الثابتة من الكود نفسه حرفيًا. ترميزه هنا يكسر التطابق.

- [ ] **Step 2: أضف تنسيقات محتوى التراكب**

ألحِق في نهاية `assets/css/styles.css` (بعد ما أُضيف في المَهمّة ١):

```css
/* --- الشرائح --- */
.pcard__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pcard__chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 0.32em 0.75em; border-radius: 999px;
  background: rgb(var(--card-scrim) / .55);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  color: #F6F3EB; font-size: 0.72rem; line-height: 1.6; white-space: nowrap;
}
/* الخلفية شبه الشفافة وحدها كافية للتباين متى غاب دعم backdrop-filter */
.pcard__chip--available { color: #D2C19C; }
.pcard__chip--reserved  { color: #E0B278; }
.pcard__chip--sold      { color: rgb(246 243 235 / .62); }
.pcard__chip--soon      { color: #A9C0D4; }
.pcard__code {
  font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.06em;
  color: rgb(246 243 235 / .55); padding-block-start: 0.4em; white-space: nowrap;
}

/* --- الجزء السفلي --- */
.pcard__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); }
.pcard__title {
  margin: 0; color: #F6F3EB; font-size: clamp(1.15rem, 2.2vw, 1.4rem); line-height: 1.35;
  font-family: var(--font-en-display);
}
html[lang="ar"] .pcard__title { font-family: var(--font-ar-display); }
.pcard__go { color: #D2C19C; font-size: 1.1rem; line-height: 1; transition: transform .25s ease; }
.project-card:hover .pcard__go { transform: translateX(-4px); }
html[lang="en"] .project-card:hover .pcard__go,
html[lang="zh"] .project-card:hover .pcard__go { transform: translateX(4px); }

.pcard__loc {
  display: flex; align-items: center; gap: 5px; margin-top: 5px;
  color: rgb(246 243 235 / .78); font-size: 0.8rem;
}
.pcard__rule { height: 1px; margin: 10px 0 8px; background: rgb(210 193 156 / .32); }
.pcard__price { color: #F6F3EB; font-size: 1.05rem; font-weight: 500; }

/* --- شريط نسبة المبيع (يظهر فقط متى sold > 0) --- */
.pcard__sold { margin-top: 8px; }
.pcard__sold-fill { display: block; height: 3px; border-radius: 2px; background: #D2C19C; }
.pcard__sold-label { display: block; margin-top: 4px; font-size: 0.7rem; color: rgb(246 243 235 / .7); }
```

- [ ] **Step 3: افحص بصريًا**

حدّث `http://localhost:8000/projects.html`.

Expected:
- كل النص داخل الصورة على التدرّج، ولا يوجد صندوق أبيض تحتها
- شرائح أعلى اليمين، والكود المونو أعلى اليسار
- بطاقات `RY-1039` و`RY-1063` (البذور) تُظهر شريط نسبة المبيع؛ غيرها لا
- المرور بالفأرة: الصورة تتكبّر والسهم يزحف

- [ ] **Step 4: افحص الوضع الداكن — المزلق الأهم**

اضغط زر تبديل الثيم إلى الداكن.

Expected: **التدرّج يبقى داكنًا والنص أبيض مقروء.** لو انقلب التدرّج فاتحًا فمعناه أن
قاعدة ما تستعمل `var(--ink)` بدل `var(--card-scrim)` — ابحث عنها وأصلحها.

- [ ] **Step 5: التزم**

```bash
git add assets/js/main.js assets/css/styles.css
git commit -m "feat(cards): بطاقة المشروع كاملة الصورة بتراكب"
```

---

## Task 4: ترميز شريط الفلاتر

**Files:**
- Modify: `projects.html:64-88`

- [ ] **Step 1: استبدل كتلة `.filters`**

احذف `<div class="filters"> ... </div>` كاملة (الأسطر ٦٤–٨٨) وضع مكانها:

```html
      <div class="filterbar">
        <p class="filterbar__count" id="projCount"></p>

        <nav class="chips chips--tabs" role="tablist" id="filterCity"
             aria-label="تصفية حسب المدينة" data-cur="all">
          <button type="button" class="chip chip--on" role="tab" aria-selected="true"  data-val="all"     data-en="All cities" data-zh="所有城市">كل المدن</button>
          <button type="button" class="chip"          role="tab" aria-selected="false" data-val="riyadh"  data-en="Riyadh" data-zh="利雅得">الرياض</button>
          <button type="button" class="chip"          role="tab" aria-selected="false" data-val="jeddah"  data-en="Jeddah" data-zh="吉达">جدة</button>
          <button type="button" class="chip"          role="tab" aria-selected="false" data-val="madinah" data-en="Madinah" data-zh="麦地那">المدينة المنورة</button>
          <button type="button" class="chip"          role="tab" aria-selected="false" data-val="eastern" data-en="Eastern Province" data-zh="东部省">المنطقة الشرقية</button>
          <button type="button" class="chip"          role="tab" aria-selected="false" data-val="makkah"  data-en="Makkah" data-zh="麦加">مكة المكرمة</button>
        </nav>

        <!-- صفّا النوع والحالة يُبنيان من البيانات في renderFilterRows()، ويبقيان
             مخفيّين ما لم توجد قيمتان مختلفتان على الأقل. المدن وحدها ثابتة عمدًا:
             ضغط مدينة بلا مشاريع يطلّع رسالة «قريبًا · تواصل معنا» وهي التقاط عملاء مقصود. -->
        <nav class="chips chips--sub" role="tablist" id="filterType"
             aria-label="تصفية حسب النوع" data-cur="all" hidden></nav>
        <nav class="chips chips--sub" role="tablist" id="filterStatus"
             aria-label="تصفية حسب الحالة" data-cur="all" hidden></nav>
      </div>
```

- [ ] **Step 2: أضف تنسيقات شريط الفلاتر**

ألحِق في نهاية `assets/css/styles.css`:

```css
/* --- شريط الفلاتر: تبويبات دائرية بدل قوائم select --- */
.filterbar { margin-bottom: clamp(1.5rem, 3vw, 2.5rem); }
.filterbar__count {
  margin: 0 0 var(--sp-4); font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-family: var(--font-en-display); color: var(--fg);
}
html[lang="ar"] .filterbar__count { font-family: var(--font-ar-display); }

/* .chip الموجود مصمَّم لـ <a>؛ هذي تسوّي <button> به */
button.chip { border: 0; font: inherit; cursor: pointer; }

.chips--tabs {
  margin-bottom: var(--sp-3);
  flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
  padding-block: 4px;            /* حيّز لظلّ --raise-sm كي لا يُقصّ عند التمرير */
}
.chips--tabs::-webkit-scrollbar { display: none; }
.chips--sub { margin-bottom: var(--sp-3); gap: var(--sp-2); }

.chip--on { box-shadow: var(--inset-sm); color: var(--champ); }
.chip--sm {
  padding: 0.42em 1.05em; font-size: 0.82rem;
  background: transparent; box-shadow: none; color: var(--fg-soft);
}
.chip--sm.chip--on { background: var(--surf); box-shadow: var(--inset-sm); color: var(--champ); }
```

- [ ] **Step 3: تأكّد أن الصفحة لم تنكسر**

حدّث `http://localhost:8000/projects.html`.

Expected: صف المدن ظاهر بشكل حبوب دائرية، و«كل المدن» عليها الحالة الغائرة. **الفلترة
لا تشتغل بعد** — المَهمّة ٥ توصّلها. صفّا النوع والحالة مخفيّان.

- [ ] **Step 4: التزم**

```bash
git add projects.html assets/css/styles.css
git commit -m "feat(filters): تبويبات دائرية بدل قوائم select"
```

---

## Task 5: منطق الفلاتر ومزامنة الرابط

**Files:**
- Modify: `assets/js/main.js:132-135` (`currentFilters`)
- Modify: `assets/js/main.js:163-174` (`initFiltersFromUrl`)
- Modify: `assets/js/main.js` (`renderDynamic` و`boot`)

- [ ] **Step 1: استبدل `currentFilters`**

احذف:

```js
  function currentFilters() {
    function v(id) { var el = document.getElementById(id); return el ? el.value : "all"; }
    return { city: v("filterCity"), type: v("filterType"), status: v("filterStatus") };
  }
```

وضع مكانها:

```js
  function currentFilters() {
    function v(id) {
      var row = document.getElementById(id);
      if (!row) return "all";
      var on = row.querySelector('[aria-selected="true"]');
      return on ? on.getAttribute("data-val") : "all";     // صف مخفي/فارغ = بلا تصفية
    }
    return { city: v("filterCity"), type: v("filterType"), status: v("filterStatus") };
  }

  /* يضبط حبّة فعّالة في صف، ويحفظ الاختيار في data-cur ليصمد عبر إعادة الرسم */
  function setFilter(rowId, val) {
    var row = document.getElementById(rowId);
    if (!row) return;
    row.setAttribute("data-cur", val);
    var btns = row.querySelectorAll(".chip");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-val") === val;
      btns[i].classList.toggle("chip--on", on);
      btns[i].setAttribute("aria-selected", on ? "true" : "false");
    }
  }

  /* صفّا النوع والحالة يُبنيان من البيانات: يكبران تلقائيًا عند إضافة فلل أو
     مشروع مباع، ويختفيان ما دامت القيمة واحدة (حبّة واحدة ليست تصفية). */
  function renderFilterRow(rowId, key, labelFor) {
    var row = document.getElementById(rowId);
    if (!row) return;
    var keys = [], first = {};
    for (var i = 0; i < PROJECTS.length; i++) {
      var k = PROJECTS[i][key];
      if (!k || first[k]) continue;
      first[k] = PROJECTS[i]; keys.push(k);
    }
    if (keys.length < 2) { row.hidden = true; row.innerHTML = ""; return; }
    row.hidden = false;
    var cur = row.getAttribute("data-cur") || "all";
    row.innerHTML = ["all"].concat(keys).map(function (k) {
      var on = k === cur;
      return '<button type="button" class="chip chip--sm' + (on ? " chip--on" : "") + '"' +
        ' role="tab" aria-selected="' + (on ? "true" : "false") + '" data-val="' + esc(k) + '">' +
        esc(k === "all" ? t("allLabel") : labelFor(first[k])) + '</button>';
    }).join("");
  }

  function renderFilterRows() {
    renderFilterRow("filterType", "type", function (p) { return L(p.typeAr, p.typeEn, p.typeZh); });
    renderFilterRow("filterStatus", "status", function (p) {
      var k = (p.status === "sold" || p.status === "reserved" || p.status === "soon") ? p.status : "available";
      return t(k);
    });
  }

  /* replaceState لا pushState: التصفية ليست تنقّلًا، وزر الرجوع يجب أن يغادر
     الصفحة لا أن يتراجع خطوة في الفلاتر. */
  function syncUrl() {
    var f = currentFilters(), q = [];
    if (f.city !== "all") q.push("city=" + encodeURIComponent(f.city));
    if (f.type !== "all") q.push("type=" + encodeURIComponent(f.type));
    if (f.status !== "all") q.push("status=" + encodeURIComponent(f.status));
    history.replaceState(null, "", location.pathname + (q.length ? "?" + q.join("&") : ""));
  }

  function initFilterTabs() {
    ["filterCity", "filterType", "filterStatus"].forEach(function (id) {
      var row = document.getElementById(id);
      if (!row) return;
      row.addEventListener("click", function (e) {
        var btn = e.target.closest(".chip");
        if (!btn || !row.contains(btn)) return;
        setFilter(id, btn.getAttribute("data-val"));
        syncUrl();
        renderProjectsPage();
      });
    });
  }
```

- [ ] **Step 2: استبدل `initFiltersFromUrl`**

احذف جسم الدالة القديم (الذي يضبط `el.value`) وضع:

```js
  function initFiltersFromUrl() {
    if (!document.getElementById("projectsGrid")) return;
    var q = new URLSearchParams(location.search);
    [["city", "filterCity"], ["type", "filterType"], ["status", "filterStatus"]].forEach(function (pair) {
      var val = q.get(pair[0]);
      if (!val) return;
      var row = document.getElementById(pair[1]);
      if (!row) return;
      // لا نضبط إلا قيمة لها حبّة فعلًا (يمنع فلترًا فارغًا من رابط خاطئ)
      var btns = row.querySelectorAll(".chip");
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute("data-val") === val) { setFilter(pair[1], val); return; }
      }
    });
  }
```

- [ ] **Step 3: عدّل `renderDynamic` و`boot`**

في `renderDynamic`، أضف `renderFilterRows();` كأول سطر — تسميات الحبوب تحتاج
إعادة ترجمة عند تبديل اللغة، و`data-cur` يحفظ الاختيار:

```js
  function renderDynamic() {
    renderFilterRows();
    renderFeatured();
    renderProjectsPage();
    renderNews();
    renderArticlePreview();
    renderPartners();
    relabelStats();
  }
```

في `boot`، أضف `renderFilterRows()` **قبل** `initFiltersFromUrl()` (الحبوب يجب أن
توجد قبل البحث فيها):

```js
  function boot() {
    renderFilterRows();     // تبني حبوب النوع والحالة
    initFiltersFromUrl();   // قبل أول رسم حتى تُطبَّق الفلاتر القادمة من الرابط
    renderFeatured();
```

وفي آخر `boot`، احذف مستمعي `<select>` القدامى:

```js
    // فلاتر المشاريع
    ["filterCity", "filterType", "filterStatus"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", renderProjectsPage);
    });
```

وضع مكانها:

```js
    initFilterTabs();
```

- [ ] **Step 4: تحقّق من الصياغة**

Run:
```bash
node --check assets/js/main.js
```

Expected: لا مخرجات.

- [ ] **Step 5: افحص السلوك**

على `http://localhost:8000/projects.html` جرّب بالترتيب:

| الإجراء | المتوقَّع |
|---|---|
| اضغط «الرياض» | الشبكة تتصفّى، الحبّة تصير غائرة، الرابط يصير `?city=riyadh` |
| اضغط «جدة» | رسالة «مشاريعنا في هذه المدينة قريبًا» + زر تواصل — لا رسالة جافّة |
| اضغط زر الرجوع | **تغادر الصفحة** ولا تتراجع في الفلاتر |
| افتح `projects.html?city=riyadh&type=villa` | الحبّتان فعّالتان والشبكة مصفّاة |
| افتح `projects.html?city=zzz` | يُتجاهَل، «كل المدن» تبقى فعّالة |
| بدّل اللغة إلى EN | تسميات الحبوب تُترجم **والاختيار الحالي يبقى فعّالًا** |
| العدّاد أعلى الشريط | يتحدّث مع كل تصفية |

> صفّا النوع والحالة سيظهران هنا لأن بيانات البذور فيها أنواع وحالات متعددة.
> على البيانات الحيّة سيظهر صف النوع فقط (شقق/تاون هاوس) ويختفي صف الحالة.

- [ ] **Step 6: التزم**

```bash
git add assets/js/main.js
git commit -m "feat(filters): منطق التبويبات + اشتقاق الصفوف + مزامنة الرابط"
```

---

## Task 6: حذف CSS الميّت

**Files:**
- Modify: `assets/css/styles.css` (القسمان ١٢ و١٣)

- [ ] **Step 1: تحقّق من عدم الاستخدام قبل أي حذف**

Run:
```bash
grep -rn "project-card__body\|project-card__foot\|project-card__meta\|project-card__type\|project-card__price\|project-card__code\|class=\"sold\|sold__\|class=\"filters\|filters__count" \
  --include=*.html --include=*.js --include=*.mjs . | grep -v node_modules | grep -v "^./assets/css"
```

Expected: **لا مخرجات.** أي سطر يظهر معناه أن المُحدِّد لا يزال مستخدَمًا — **لا تحذفه**،
واذكره في رسالة الالتزام.

- [ ] **Step 2: تحقّق من `.badge` بشكل منفصل**

Run:
```bash
grep -rn "class=\"badge\|badge--" --include=*.html --include=*.js --include=*.mjs . | grep -v node_modules
```

Expected: لا مخرجات (البطاقة الجديدة تستعمل `.pcard__chip`، وصفحات التفاصيل تستعمل
`.status-pill`). إن ظهر شيء فأبقِ قواعد `.badge`.

- [ ] **Step 3: احذف المُحدِّدات المؤكَّد عدم استخدامها**

من `assets/css/styles.css`، احذف هذي القواعد فقط:

- `.badge`، `html[lang="ar"] .badge`، `.badge--sold`، `.badge--reserved`، `.badge--soon` (حوالي ٣١٩–٣٢٧)
- `.project-card__body`، `.project-card__loc`، `.project-card__title`، `.project-card__type`، `html[lang="ar"] .project-card__type` (حوالي ٣٩١–٣٩٥)
- `.sold`، `.sold__bar`، `.sold__fill`، `.sold__label`، `.sold__label b` (حوالي ٣٩٦–٤٠٢)
- `.project-card__foot`، `.project-card__price`، `.project-card__price b`، `html[lang="ar"] .project-card__price b`، `.project-card__price span`، `.project-card__meta`، `.project-card__code` (حوالي ٤٠٣–٤١٢)
- `.filters`، `.filters select`، `.filters__count`، `html[lang="ar"] .filters__count` (حوالي ٤١٧–٤٢٣)

**أبقِ صراحةً:**
- `.link-arrow` و`.link-arrow:hover` — تستعملها `articleCard` وصفحات أخرى
- `.status-pill*` — صفحات تفاصيل المشاريع
- `.empty-state` — رسالتا «قريبًا» و«لا توجد نتائج»
- `.project-card` و`.project-card__media` و`.project-card:hover` الأساسية — البطاقة الجديدة تبني فوقها
- كل ما يخصّ `.punit-card` — مكوّن مستقل لصفحات التفاصيل

- [ ] **Step 4: تأكّد أن شيئًا لم ينكسر**

حدّث `projects.html` و`index.html` و`news.html` وصفحة مشروع واحدة
(`projects/RY-1042.html` إن وُجدت محليًا، وإلا تجاوز).

Expected: لا تغيّر بصري في أي منها عن الخطوة السابقة.

- [ ] **Step 5: التزم**

```bash
git add assets/css/styles.css
git commit -m "chore(css): حذف تنسيقات جسم البطاقة والقوائم المنسدلة الميّتة"
```

---

## Task 7: فحص المصفوفة الكاملة

**Files:** لا تعديل — فحص فقط. أي عطل يُصلَح ويُلتزَم على حدة.

- [ ] **Step 1: العروض الثلاثة**

على `projects.html` بأدوات المطوّر:

| العرض | المتوقَّع |
|---|---|
| ١٤٤٠px | ٣ أعمدة، البطاقة ٤:٥، لا التفاف نصّ |
| ٧٦٨px | عمودان، صف المدن يبدأ بالانزلاق أفقيًا |
| ٣٩٠px | عمود واحد، صف المدن ينزلق بلا شريط تمرير ظاهر، الشرائح لا تتراكب مع الكود |

- [ ] **Step 2: الوضعان**

بدّل الثيم فاتح ↔ داكن على كل عرض.

Expected: التدرّج داكن دائمًا والنص أبيض مقروء في الحالتين. الحبوب تتبع الثيم
(بارزة في الفاتح والداكن، والفعّالة غائرة).

- [ ] **Step 3: اللغات الثلاث**

بدّل بين ع / EN / 中文.

Expected: البطاقة تنقلب اتجاهًا كاملًا (الشرائح تنتقل للجهة المقابلة والسهم ينعكس)،
لا نصّ مقصوص، والعنوان يستعمل Amiri في العربية و Cormorant في غيرها.

- [ ] **Step 4: الرئيسية**

افتح `index.html`.

Expected: البطاقات المميّزة أخذت الشكل الجديد. شرائح المدن أعلاها (`.chip` الأصلية،
روابط `<a>`) لم تتأثّر بقاعدة `button.chip`.

- [ ] **Step 5: الوصولية بلوحة المفاتيح**

من شريط العنوان اضغط Tab متتاليًا.

Expected: كل حبّة تستقبل التركيز بحلقة ذهبية ظاهرة (`:focus-visible`)، وكل بطاقة
هدف تركيز واحد لا عدّة أهداف. لو انقُصّت حلقة تركيز البطاقة بسبب `overflow: hidden`،
أضف:

```css
.project-card:focus-visible { outline-offset: -3px; }
```

- [ ] **Step 6: التزم أي إصلاحات**

```bash
git add -A
git commit -m "fix(cards): إصلاحات الفحص البصري عبر العروض واللغات والثيمات"
```

---

## المتبقّي خارج النطاق

- حقل «موعد التسليم» (يحتاج عمودًا + حقل لوحة تحكّم + تعبئة يدوية)
- شعار المطوّر على البطاقة (لا علاقة مطوِّر↔مشروع في المخطط)
- بحث نصّي أو فلتر سعر
- صفحة تفاصيل المشروع — لا تُمسّ
