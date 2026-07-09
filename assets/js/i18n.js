/* ==========================================================================
   RYLIST — تبديل اللغة (عربي RTL افتراضي ⇄ إنجليزي LTR)
   الطريقة: النص العربي مكتوب داخل HTML (جيّد للـSEO)، والإنجليزي في data-en.
   لا قاموس مركزي ولا مفاتيح — الترجمة بجوار العنصر مباشرة.
   ========================================================================== */
(function () {
  "use strict";
  var KEY = "rylist-lang";
  var origText = new Map();   // النص العربي الأصلي لكل عنصر
  var origPh = new Map();     // الـplaceholder العربي الأصلي

  function getLang() {
    return document.documentElement.getAttribute("lang") || "ar";
  }

  function captureOriginals() {
    document.querySelectorAll("[data-en]").forEach(function (el) {
      if (!origText.has(el)) origText.set(el, el.textContent);
    });
    document.querySelectorAll("[data-en-ph]").forEach(function (el) {
      if (!origPh.has(el)) origPh.set(el, el.getAttribute("placeholder") || "");
    });
  }

  function apply(lang) {
    var html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

    document.querySelectorAll("[data-en]").forEach(function (el) {
      el.textContent = lang === "ar" ? (origText.get(el) || el.textContent) : el.getAttribute("data-en");
    });
    document.querySelectorAll("[data-en-ph]").forEach(function (el) {
      el.setAttribute("placeholder", lang === "ar" ? (origPh.get(el) || "") : el.getAttribute("data-en-ph"));
    });

    // زر التبديل يعرض اللغة الأخرى
    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.textContent = lang === "ar" ? "EN" : "ع";
      btn.setAttribute("aria-label", lang === "ar" ? "Switch to English" : "التبديل إلى العربية");
    });

    try { localStorage.setItem(KEY, lang); } catch (e) {}

    // إخبار بقية الكود (البطاقات الديناميكية) بإعادة الرسم
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: lang } }));
  }

  function toggle() {
    apply(getLang() === "ar" ? "en" : "ar");
  }

  function init() {
    captureOriginals();
    var stored;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    var lang = stored === "en" || stored === "ar" ? stored : "ar";
    apply(lang);

    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.addEventListener("click", toggle);
    });
  }

  // واجهة عامة مختصرة
  window.RYLIST = window.RYLIST || {};
  window.RYLIST.getLang = getLang;
  window.RYLIST.setLang = apply;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
