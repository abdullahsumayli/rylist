/* ==========================================================================
   RYLIST — السلوك (رسم البطاقات، الفلترة، القائمة، العدّادات، النموذج)
   يعمل على كل الصفحات؛ كل بحث عن عنصر محميّ بشرط وجوده.
   ========================================================================== */
(function () {
  "use strict";

  var lang = function () { return (window.RYLIST && window.RYLIST.getLang()) || document.documentElement.lang || "ar"; };
  var isAr = function () { return lang() === "ar"; };

  // اختيار القيمة حسب اللغة الحالية (عربي/إنجليزي/صيني) مع سقوط آمن
  var L = function (ar, en, zh) { var l = lang(); return l === "en" ? (en || ar) : l === "zh" ? (zh || en || ar) : ar; };

  /* ----- نصوص واجهة البطاقات (ثلاثية اللغة) ----- */
  var T = {
    available: { ar: "متاح", en: "Available", zh: "可售" },
    reserved: { ar: "محجوز", en: "Reserved", zh: "已预订" },
    sold: { ar: "مباع", en: "Sold", zh: "已售" },
    soon: { ar: "قريبًا", en: "Soon", zh: "即将推出" },
    priceOnRequest: { ar: "السعر عند الطلب", en: "Price on request", zh: "价格面议" },
    soldPct: { ar: "مباع", en: "Sold", zh: "已售" },
    view: { ar: "شاهد التفاصيل", en: "View details", zh: "查看详情" },
    beds: { ar: "غرف", en: "beds", zh: "卧室" },
    area: { ar: "م²", en: "m²", zh: "㎡" },
    code: { ar: "كود", en: "Code", zh: "编号" },
    readMore: { ar: "اقرأ المزيد", en: "Read more", zh: "阅读更多" },
    none: { ar: "لا توجد مشاريع مطابقة للفلاتر الحالية.", en: "No projects match the current filters.", zh: "没有符合当前筛选条件的项目。" },
    // مدينة مختارة بلا مشاريع بعد — رسالة «قريبًا» بدل «لا توجد نتائج»
    soonCity: { ar: "مشاريعنا في هذه المدينة قريبًا. تواصل معنا ونرشّح لك الأنسب.", en: "Our projects in this city are coming soon. Get in touch and we’ll suggest the best fit.", zh: "我们在该城市的项目即将推出。请联系我们，我们会为您推荐最合适的选择。" },
    contactUs: { ar: "تواصل معنا", en: "Contact us", zh: "联系我们" },
    count: { ar: "مشروع", en: "projects", zh: "个项目" },
    allLabel: { ar: "الكل", en: "All", zh: "全部" }
  };
  function t(k) { return L(T[k].ar, T[k].en, T[k].zh); }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function waLink(text) {
    return "https://wa.me/" + CONTACT.whatsapp + "?text=" + encodeURIComponent(text);
  }

  function fmtPrice(min, max) {
    if (!min && !max) return t("priceOnRequest");
    var lo = min || max, hi = max || min;
    function f(x) { return Number(x).toLocaleString("en-US"); }
    var range = lo === hi ? f(lo) : f(lo) + " – " + f(hi);
    return L(range + " ريال", "SAR " + range, range + " 里亚尔");
  }

  function fmtMeta(p) {
    var parts = [];
    if (p.area) parts.push(p.area + " " + t("area"));
    if (p.bedsMax > 0) parts.push((p.bedsMin === p.bedsMax ? String(p.bedsMin) : p.bedsMin + "–" + p.bedsMax) + " " + t("beds"));
    return parts.join(" · ");
  }

  function localeDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "";               // guard against "Invalid Date"
    try { return d.toLocaleDateString(L("ar-SA", "en-GB", "zh-CN"), { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return iso; }
  }

  /* ----- أيقونات البطاقة (سطرية، بلا طلبات شبكة) ----- */
  var ICON_PIN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var ICON_BED = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 18V7m0 6h18v5M7 11a2 2 0 1 0 0-.01M11 13h10V9a2 2 0 0 0-2-2h-8z"/></svg>';
  var ICON_AREA = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 4v16M4 9h16"/></svg>';

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

  /* ----- بطاقة خبر ----- */
  function articleCard(a) {
    var title = L(a.titleAr, a.titleEn, a.titleZh);
    var cat = L(a.catAr, a.catEn, a.catZh);
    var excerpt = L(a.excerptAr, a.excerptEn, a.excerptZh);
    var href = a.slug ? "news/" + a.slug + ".html" : "";
    var media = href
      ? '<a class="article-card__media" href="' + href + '"><img loading="lazy" src="' + a.img + '" alt="' + esc(title) + '"></a>'
      : '<span class="article-card__media"><img loading="lazy" src="' + a.img + '" alt="' + esc(title) + '"></span>';
    var more = href
      ? '<a class="link-arrow" href="' + href + '">' + t("readMore") + '</a>'
      : '';
    return '' +
      '<article class="article-card">' +
        media +
        (cat ? '<div class="article-card__cat">' + esc(cat) + '</div>' : '') +
        '<h3 class="article-card__title">' + esc(title) + '</h3>' +
        '<p class="article-card__excerpt">' + esc(excerpt) + '</p>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">' +
          '<span class="article-card__date">' + localeDate(a.date) + '</span>' +
          more +
        '</div>' +
      '</article>';
  }

  /* ----- الرسم ----- */
  function renderInto(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  function currentFilters() {
    function v(id) { var el = document.getElementById(id); return el ? el.value : "all"; }
    return { city: v("filterCity"), type: v("filterType"), status: v("filterStatus") };
  }

  function filteredProjects() {
    var f = currentFilters();
    return PROJECTS.filter(function (p) {
      return (f.city === "all" || p.cityKey === f.city) &&
             (f.type === "all" || p.type === f.type) &&
             (f.status === "all" || p.status === f.status);
    });
  }

  function renderProjectsPage() {
    var grid = document.getElementById("projectsGrid");
    if (!grid) return;
    var list = filteredProjects();
    // مدينة محدّدة بلا مشاريع: «قريبًا» + دعوة للتواصل، لا «لا توجد نتائج» الجافّة
    var f = currentFilters();
    var cityOnly = f.city !== "all" && f.type === "all" && f.status === "all";
    var emptyHtml = cityOnly
      ? '<div class="empty-state">' + esc(t("soonCity")) +
          '<div class="btn-row" style="justify-content:center"><a class="btn btn--primary" href="contact.html">' + esc(t("contactUs")) + '</a></div>' +
        '</div>'
      : '<div class="empty-state">' + esc(t("none")) + '</div>';
    grid.innerHTML = list.length ? list.map(projectCard).join("") : emptyHtml;
    var count = document.getElementById("projCount");
    if (count) count.textContent = list.length + " " + t("count");
  }

  /* ----- تمرير الفلاتر عبر الرابط (شرائح المدن في الرئيسية → صفحة المشاريع) ----- */
  function initFiltersFromUrl() {
    if (!document.getElementById("projectsGrid")) return;
    var q = new URLSearchParams(location.search);
    [["city", "filterCity"], ["type", "filterType"], ["status", "filterStatus"]].forEach(function (pair) {
      var val = q.get(pair[0]);
      if (!val) return;
      var el = document.getElementById(pair[1]);
      // لا نضبط إلا قيمة موجودة فعلًا في القائمة (يمنع فلترًا فارغًا من رابط خاطئ)
      if (el && Array.prototype.some.call(el.options, function (o) { return o.value === val; })) el.value = val;
    });
  }

  /* على الجوال تتراصّ البطاقات عمودًا واحدًا فتلتهم ~2500px من التمرير قبل بقية
     الصفحة. نقصّها إلى ٣ هناك — ورابط «كل المشاريع» في رأس القسم يكمل الباقي.
     القصّ في الـJS لا بالـCSS حتى لا يُحمّل المتصفّح صور بطاقات لن تُعرض. */
  var FEATURED_MOBILE = 3, FEATURED_DESKTOP = 6;
  function featuredLimit() {
    return (window.matchMedia && window.matchMedia("(max-width: 560px)").matches)
      ? FEATURED_MOBILE : FEATURED_DESKTOP;
  }
  var featuredShown = -1;
  function renderFeatured() {
    var el = document.getElementById("featuredProjects");
    if (!el) return;
    var limit = featuredLimit();
    featuredShown = limit;
    el.innerHTML = PROJECTS.filter(function (p) { return p.featured; }).slice(0, limit).map(projectCard).join("");
  }

  // أعِد الرسم فقط عند عبور نقطة الفصل — لا عند كل حركة تدوير أو تغيير ارتفاع.
  function watchFeaturedBreakpoint() {
    if (!document.getElementById("featuredProjects")) return;
    window.addEventListener("resize", function () {
      if (featuredLimit() !== featuredShown) renderFeatured();
    });
  }

  function renderNews() {
    var el = document.getElementById("newsGrid");
    if (!el) return;
    var limit = parseInt(el.getAttribute("data-limit") || "0", 10);
    var list = limit ? NEWS.slice(0, limit) : NEWS;
    el.innerHTML = list.map(articleCard).join("");
  }

  /* ----- معاينة المقال (article.html?preview=1) -----
     صفحة معاينة للمسوّدة قبل النشر فقط — تعرض المسوّدة (من ذاكرة المتصفّح) بنفس
     شكل صفحة المقال المنشورة (adetail). المقالات المنشورة لها صفحات ثابتة
     news/<slug>.html يبنيها scripts/lib/newsPages.mjs. */
  /* ===== منقّي HTML (نفس قائمة السماح في scripts/lib/sanitizeHtml.mjs) ===== */
  var SAN_ALLOWED = { p:1,h2:1,h3:1,h4:1,ul:1,ol:1,li:1,a:1,img:1,table:1,thead:1,tbody:1,tr:1,td:1,th:1,strong:1,em:1,b:1,i:1,br:1,figure:1,figcaption:1,blockquote:1 };
  var SAN_DROP = { script:1, style:1 };
  var SAN_VOID = { img:1, br:1 };
  function sanUrl(v, re) { v = String(v || "").trim(); return re.test(v) ? v : ""; }
  function sanClass(v) { return String(v || "").split(/\s+/).filter(function (c) { return c.indexOf("adetail__") === 0; }).join(" "); }
  function sanWalk(node) {
    if (node.nodeType === 3) return esc(node.nodeValue);
    if (node.nodeType !== 1) return "";
    var tag = node.tagName.toLowerCase();
    if (SAN_DROP[tag]) return "";
    var inner = ""; for (var i = 0; i < node.childNodes.length; i++) inner += sanWalk(node.childNodes[i]);
    if (!SAN_ALLOWED[tag]) return inner;                              // unwrap unknown tags
    var attrs = "";
    var cls = sanClass(node.getAttribute("class")); if (cls) attrs += ' class="' + esc(cls) + '"';
    if (tag === "a") { var h = sanUrl(node.getAttribute("href"), /^(https?:|mailto:)/i); if (h) attrs += ' href="' + esc(h) + '"'; attrs += ' target="_blank" rel="noopener nofollow"'; }
    if (tag === "img") { var s2 = sanUrl(node.getAttribute("src"), /^(https?:|data:image\/)/i); if (s2) attrs += ' src="' + esc(s2) + '"'; attrs += ' alt="' + esc(node.getAttribute("alt") || "") + '"'; }
    if (tag === "td" || tag === "th") { ["colspan", "rowspan"].forEach(function (k) { var v = node.getAttribute(k); if (v && /^\d+$/.test(v)) attrs += ' ' + k + '="' + esc(v) + '"'; }); }
    if (SAN_VOID[tag]) return "<" + tag + attrs + ">";
    return "<" + tag + attrs + ">" + inner + "</" + tag + ">";
  }
  function sanitizeHtml(html) {
    var s = String(html || "").trim(); if (!s) return "";
    var doc = new DOMParser().parseFromString(s, "text/html");
    var out = ""; var kids = doc.body.childNodes;
    for (var i = 0; i < kids.length; i++) out += sanWalk(kids[i]);
    return out;
  }

  // يطابق formatBody في scripts/lib/renderArticle.mjs: نص عادي → فقرات؛ HTML يُنقّى.
  function formatBody(raw, title) {
    var s = String(raw || "").trim();
    if (!s) return "";
    if (/<\/?[a-z][a-z0-9]*[\s/>]/i.test(s)) return sanitizeHtml(s);  // أي وسم HTML (بلوك أو سطري) — نقّه
    var lines = s.split("\n");
    if (title && lines[0].trim() === String(title).trim()) lines.shift();  // أسقط سطر العنوان المكرّر
    s = lines.join("\n").trim();
    return s.split(/\n\s*\n/).map(function (p) {
      return "<p>" + esc(p.trim()).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function renderArticlePreview() {
    var view = document.getElementById("articleView");
    if (!view) return;
    if (new URLSearchParams(location.search).get("preview") !== "1") return;
    var p = null;
    try { var raw = localStorage.getItem("rylist:news-preview"); if (raw) p = JSON.parse(raw); } catch (e) { p = null; }
    var loc = lang();
    var i18n = (p && p.i18n) || {};
    var title = (i18n.title && (i18n.title[loc] || i18n.title.ar)) || "";
    var body = (i18n.body && (i18n.body[loc] || i18n.body.ar)) || "";
    var img = (p && p.image_url) || "";
    var date = localeDate(((p && p.published_at) || "").slice(0, 10));
    var back = L("عودة إلى المدونة", "Back to blog", "返回博客");
    if (title) document.title = title + " — " + L("معاينة", "Preview", "预览");
    view.innerHTML = '' +
      '<a class="pdetail__back" href="news.html">← RYLIST</a>' +
      (img ? '<figure class="pdetail__hero"><img src="' + esc(img) + '" alt="' + esc(title) + '"></figure>' : '') +
      '<header class="pdetail__head adetail__head">' +
        '<div class="adetail__meta">' + (date ? '<span class="article-card__date">' + date + '</span>' : '') + '</div>' +
        '<h1>' + esc(title) + '</h1>' +
      '</header>' +
      '<div class="pdetail__desc adetail__body">' + formatBody(body, title) + '</div>' +
      '<div class="btn-row"><a class="btn btn--primary" href="news.html">' + back + '</a></div>';
    var flag = document.getElementById("previewFlag");
    if (flag) { flag.textContent = L("معاينة — مسودة (لم تُنشر بعد)", "Preview — draft (not published)", "预览 — 草稿（尚未发布）"); flag.hidden = false; }
  }

  function renderPartners() {
    var el = document.getElementById("partnersGrid");
    if (!el) return;
    var withLogo = PARTNERS.filter(function (p) { return p.logo; });
    var sec = el.closest ? el.closest("section") : null;
    // بلا شعارات: يبقى شريط الثقة ظاهرًا بنص بديل بدل أن يختفي القسم كلّه
    var fallback = document.getElementById("partnersFallback");
    if (!withLogo.length) {
      el.innerHTML = "";
      if (fallback) { fallback.hidden = false; if (sec) sec.hidden = false; return; }
      if (sec) sec.hidden = true;
      return;
    }
    if (fallback) fallback.hidden = true;
    if (sec) sec.hidden = false;
    el.innerHTML = withLogo.map(function (p) {
      var label = esc(L(p.ar, p.en, p.zh));
      return '<span class="partner-logo"><img src="' + esc(p.logo) + '" alt="' + label + '" title="' + label + '" loading="lazy"></span>';
    }).join("");
  }

  /* ----- الإحصائيات + العدّاد ----- */
  var statEls = [];
  function renderStats() {
    var el = document.getElementById("statsGrid");
    if (!el) return;
    // بلا أرقام: أخفِ الشريط كليًا وإلا بقي خطّ فاصل معلّق بلا محتوى
    el.hidden = !STATS.length;
    if (!STATS.length) { el.innerHTML = ""; statEls = []; return; }
    el.innerHTML = STATS.map(function (s, i) {
      return '<div class="stat">' +
        '<div class="stat__num" data-i="' + i + '">0</div>' +
        '<div class="stat__label"></div></div>';
    }).join("");
    statEls = Array.prototype.slice.call(el.querySelectorAll(".stat"));
    relabelStats();
    observeStats();
  }

  function relabelStats() {
    statEls.forEach(function (node, i) {
      var lbl = node.querySelector(".stat__label");
      if (lbl) lbl.textContent = L(STATS[i].labelAr, STATS[i].labelEn, STATS[i].labelZh);
    });
  }

  function formatNum(v, decimals) {
    var s = decimals ? v.toFixed(decimals) : Math.round(v).toString();
    // فاصلة الآلاف
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function animateStat(node, s) {
    var numEl = node.querySelector(".stat__num");
    if (!numEl || node.dataset.done) return;
    node.dataset.done = "1";
    var start = null, dur = 1400;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      numEl.innerHTML = formatNum(s.value * eased, s.decimals) +
        (s.sym ? '<span class="sym">' + s.sym + '</span>' : "");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function observeStats() {
    if (!("IntersectionObserver" in window)) {
      statEls.forEach(function (n, i) { animateStat(n, STATS[i]); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateStat(e.target, STATS[statEls.indexOf(e.target)]);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px 180px 0px" });
    statEls.forEach(function (n) { io.observe(n); });
  }

  /* ----- زر تبديل الوضع الفاتح/الداكن ----- */
  function initTheme() {
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function current() {
      return root.getAttribute("data-theme") || (mq && mq.matches ? "dark" : "light");
    }
    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"/></svg>';

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";

    function label() {
      var toDark = current() !== "dark";
      return L(
        toDark ? "الوضع الداكن" : "الوضع الفاتح",
        toDark ? "Dark mode" : "Light mode",
        toDark ? "深色模式" : "浅色模式"
      );
    }
    function render() {
      btn.innerHTML = current() === "dark" ? SUN : MOON;
      btn.setAttribute("aria-label", label());
      btn.title = label();
    }
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("rylist-theme", next); } catch (e) {}
      render();
    });

    var host = document.querySelector(".topbar__group:last-child") ||
               document.querySelector(".topbar__inner") ||
               document.querySelector(".site-header__inner");
    if (!host) return;
    host.insertBefore(btn, host.firstChild);
    render();
    document.addEventListener("langchange", render);
  }

  /* ----- قائمة الجوال ----- */
  function initMenu() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".nav");
    var backdrop = document.querySelector(".nav-backdrop");
    if (!toggle || !nav) return;
    function close() {
      nav.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    function open() {
      nav.classList.add("is-open");
      if (backdrop) backdrop.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    toggle.addEventListener("click", function () {
      nav.classList.contains("is-open") ? close() : open();
    });
    if (backdrop) backdrop.addEventListener("click", close);
    nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  /* ----- إبراز الرابط النشط ----- */
  function initActiveNav() {
    var here = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (href === here || (here === "" && href === "index.html")) a.classList.add("is-active");
    });
  }

  /* ----- روابط التواصل العامة (واتساب/بريد في الهيدر/الفوتر) ----- */
  function wireContactLinks() {
    document.querySelectorAll("[data-wa]").forEach(function (a) {
      var msg = L("مرحبًا RYLIST، لديّ استفسار.", "Hello RYLIST, I have an inquiry.", "你好 RYLIST，我有一个咨询。");
      a.setAttribute("href", waLink(msg));
    });
    document.querySelectorAll("[data-email]").forEach(function (a) {
      a.setAttribute("href", "mailto:" + CONTACT.email);
      if (a.hasAttribute("data-email-text")) a.textContent = CONTACT.email;
    });
    document.querySelectorAll("[data-phone]").forEach(function (a) {
      a.setAttribute("href", "tel:" + CONTACT.phone.replace(/\s/g, ""));
      if (a.hasAttribute("data-phone-text")) a.textContent = CONTACT.phone;
    });
    document.querySelectorAll("[data-map]").forEach(function (f) { f.setAttribute("src", CONTACT.map); });
  }

  /* ----- سنة الفوتر ----- */
  function setYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ----- بحث الرئيسية → صفحة المشاريع ----- */
  function initHomeSearch() {
    var f = document.getElementById("homeSearch");
    if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      // مرّر الاختيار لصفحة المشاريع بدل تجاهله (يلتقطه initFiltersFromUrl هناك)
      var sels = f.querySelectorAll("select");
      var q = [];
      ["city", "type"].forEach(function (k, i) {
        if (sels[i] && sels[i].value && sels[i].value !== "all") q.push(k + "=" + encodeURIComponent(sels[i].value));
      });
      location.href = "projects.html" + (q.length ? "?" + q.join("&") : "");
    });
  }

  /* ----- إعادة الرسم عند تبديل اللغة ----- */
  function renderDynamic() {
    renderFeatured();
    renderProjectsPage();
    renderNews();
    renderArticlePreview();
    renderPartners();
    relabelStats();
  }

  /* ----- ظهور تدريجي عند التمرير ----- */
  function initReveal() {
    var targets = document.querySelectorAll(".section-head, .grid-3, .grid-2, .grid-4, .steps, .faq");
    if (!targets.length) return;
    document.documentElement.classList.add("reveal-on");
    targets.forEach(function (t) { t.setAttribute("data-reveal", ""); });
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach(function (t) { t.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (t) { io.observe(t); });
  }

  function boot() {
    initFiltersFromUrl();   // قبل أول رسم حتى تُطبَّق الفلاتر القادمة من الرابط
    renderFeatured();
    renderProjectsPage();
    renderNews();
    renderArticlePreview();
    renderPartners();
    renderStats();
    initTheme();
    initMenu();
    initActiveNav();
    initHomeSearch();
    wireContactLinks();
    setYear();
    initReveal();
    watchFeaturedBreakpoint();

    // فلاتر المشاريع
    ["filterCity", "filterType", "filterStatus"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", renderProjectsPage);
    });

    document.addEventListener("langchange", function () {
      renderDynamic();
      wireContactLinks();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
