/* ==========================================================================
   RYLIST — السلوك (رسم البطاقات، الفلترة، القائمة، العدّادات، النموذج)
   يعمل على كل الصفحات؛ كل بحث عن عنصر محميّ بشرط وجوده.
   ========================================================================== */
(function () {
  "use strict";

  var lang = function () { return (window.RYLIST && window.RYLIST.getLang()) || document.documentElement.lang || "ar"; };
  var isAr = function () { return lang() === "ar"; };

  /* ----- نصوص واجهة البطاقات (ثنائية) ----- */
  var T = {
    available: { ar: "متاح", en: "Available" },
    reserved: { ar: "محجوز", en: "Reserved" },
    sold: { ar: "مباع", en: "Sold" },
    soon: { ar: "قريبًا", en: "Soon" },
    priceOnRequest: { ar: "السعر عند الطلب", en: "Price on request" },
    soldPct: { ar: "مباع", en: "Sold" },
    view: { ar: "شاهد التفاصيل", en: "View details" },
    beds: { ar: "غرف", en: "beds" },
    area: { ar: "م²", en: "m²" },
    code: { ar: "كود", en: "Code" },
    readMore: { ar: "اقرأ المزيد", en: "Read more" },
    none: { ar: "لا توجد مشاريع مطابقة للفلاتر الحالية.", en: "No projects match the current filters." },
    count: { ar: "مشروع", en: "projects" }
  };
  function t(k) { return T[k][isAr() ? "ar" : "en"]; }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function waLink(text) {
    return "https://wa.me/" + CONTACT.whatsapp + "?text=" + encodeURIComponent(text);
  }

  function fmtPrice(min, max) {
    if (!min && !max) return t("priceOnRequest");
    var lo = min || max, hi = max || min;
    function f(x) { return Number(x).toLocaleString("en-US"); }
    var range = lo === hi ? f(lo) : f(lo) + " – " + f(hi);
    return isAr() ? range + " ريال" : "SAR " + range;
  }

  function fmtMeta(p) {
    var parts = [];
    if (p.area) parts.push(p.area + " " + (isAr() ? T.area.ar : T.area.en));
    if (p.bedsMax > 0) parts.push((p.bedsMin === p.bedsMax ? String(p.bedsMin) : p.bedsMin + "–" + p.bedsMax) + " " + (isAr() ? T.beds.ar : T.beds.en));
    return parts.join(" · ");
  }

  function localeDate(iso) {
    var d = new Date(iso + "T00:00:00");
    try { return d.toLocaleDateString(isAr() ? "ar-SA" : "en-GB", { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return iso; }
  }

  /* ----- بطاقة مشروع ----- */
  function projectCard(p) {
    var title = isAr() ? p.titleAr : p.titleEn;
    var city = isAr() ? p.cityAr : p.cityEn;
    var district = isAr() ? p.districtAr : p.districtEn;
    var type = isAr() ? p.typeAr : p.typeEn;
    var stKey = (p.status === "sold" || p.status === "reserved" || p.status === "soon") ? p.status : "available";
    var statusTxt = t(stKey);
    var statusCls = { sold: "badge--sold", reserved: "badge--reserved", soon: "badge--soon" }[p.status] || "";
    var soldHtml = p.sold ? (
      '<div class="sold">' +
        '<div class="sold__label"><span>' + t("soldPct") + '</span><b>' + p.sold + '%</b></div>' +
        '<div class="sold__bar"><span class="sold__fill" style="width:' + p.sold + '%"></span></div>' +
      '</div>'
    ) : '';
    var inquiry = isAr()
      ? "مرحبًا، أرغب بتفاصيل مشروع «" + p.titleAr + "» (كود " + p.code + ")."
      : "Hello, I’d like details about “" + p.titleEn + "” (code " + p.code + ").";

    return '' +
      '<article class="project-card">' +
        '<div class="project-card__media">' +
          '<img loading="lazy" src="' + p.img + '" alt="' + esc(title) + '">' +
          '<span class="badge ' + statusCls + '">' + statusTxt + '</span>' +
        '</div>' +
        '<div class="project-card__body">' +
          '<div class="project-card__loc">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
            '<span>' + esc(district) + "، " + esc(city) + '</span>' +
          '</div>' +
          '<h3 class="project-card__title">' + esc(title) + '</h3>' +
          '<div class="project-card__type">' + esc(type) + '</div>' +
          soldHtml +
          '<div class="project-card__meta">' + fmtMeta(p) + '</div>' +
          '<div class="project-card__foot">' +
            '<div class="project-card__price"><b>' + fmtPrice(p.priceMin, p.priceMax) + '</b>' +
              '<span class="project-card__code">' + t("code") + " " + p.code + '</span></div>' +
            '<a class="link-arrow" href="' + waLink(inquiry) + '" target="_blank" rel="noopener">' + t("view") +
              '<span aria-hidden="true">' + (isAr() ? "←" : "→") + '</span></a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* ----- بطاقة خبر ----- */
  function articleCard(a) {
    var title = isAr() ? a.titleAr : a.titleEn;
    var cat = isAr() ? a.catAr : a.catEn;
    var excerpt = isAr() ? a.excerptAr : a.excerptEn;
    return '' +
      '<article class="article-card">' +
        '<a class="article-card__media" href="#"><img loading="lazy" src="' + a.img + '" alt="' + esc(title) + '"></a>' +
        '<div class="article-card__cat">' + esc(cat) + '</div>' +
        '<h3 class="article-card__title">' + esc(title) + '</h3>' +
        '<p style="font-size:.92rem">' + esc(excerpt) + '</p>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">' +
          '<span class="article-card__date">' + localeDate(a.date) + '</span>' +
          '<a class="link-arrow" href="#">' + t("readMore") + '</a>' +
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
    grid.innerHTML = list.length
      ? list.map(projectCard).join("")
      : '<div class="empty-state">' + t("none") + '</div>';
    var count = document.getElementById("projCount");
    if (count) count.textContent = list.length + " " + t("count");
  }

  function renderFeatured() {
    var el = document.getElementById("featuredProjects");
    if (!el) return;
    el.innerHTML = PROJECTS.filter(function (p) { return p.featured; }).slice(0, 6).map(projectCard).join("");
  }

  function renderNews() {
    var el = document.getElementById("newsGrid");
    if (!el) return;
    var limit = parseInt(el.getAttribute("data-limit") || "0", 10);
    var list = limit ? NEWS.slice(0, limit) : NEWS;
    el.innerHTML = list.map(articleCard).join("");
  }

  function renderPartners() {
    var el = document.getElementById("partnersGrid");
    if (!el) return;
    el.innerHTML = PARTNERS.map(function (p) {
      return '<div class="partner">' + esc(isAr() ? p.ar : p.en) + '</div>';
    }).join("");
  }

  /* ----- الإحصائيات + العدّاد ----- */
  var statEls = [];
  function renderStats() {
    var el = document.getElementById("statsGrid");
    if (!el) return;
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
      if (lbl) lbl.textContent = isAr() ? STATS[i].labelAr : STATS[i].labelEn;
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
    }, { threshold: 0.4 });
    statEls.forEach(function (n) { io.observe(n); });
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
      var msg = isAr() ? "مرحبًا RYLIST، لديّ استفسار." : "Hello RYLIST, I have an inquiry.";
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
    f.addEventListener("submit", function (e) { e.preventDefault(); location.href = "projects.html"; });
  }

  /* ----- إعادة الرسم عند تبديل اللغة ----- */
  function renderDynamic() {
    renderFeatured();
    renderProjectsPage();
    renderNews();
    renderPartners();
    relabelStats();
  }

  function boot() {
    renderFeatured();
    renderProjectsPage();
    renderNews();
    renderPartners();
    renderStats();
    initMenu();
    initActiveNav();
    initHomeSearch();
    wireContactLinks();
    setYear();

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
