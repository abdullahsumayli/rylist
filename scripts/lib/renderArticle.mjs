// Pure, testable HTML builder for the news/blog article detail page.
// Mirrors renderProject.mjs: takes a plain news object, returns an HTML string.
// No filesystem / no Supabase.

import { tr, fill } from "./renderProject.mjs";
import { excerptFrom } from "./dataJs.mjs";

const BACK = { ar: "عودة إلى الأخبار", en: "Back to news", zh: "返回新闻" };

// Localized date, matching the card's localeDate() in main.js.
export function fmtDate(iso, loc) {
  if (!iso) return "";
  const locale = loc === "ar" ? "ar-SA" : loc === "zh" ? "zh" : "en-GB";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  } catch (e) { return iso; }
}

export function heroHtml(image, alt) {
  return image ? `<figure class="pdetail__hero"><img src="${image}" alt="${alt}"></figure>` : "";
}

// Assemble one full article page. `ctx` = { loc, dir, base, theme }.
export function renderArticleHtml(tmpl, n, ctx) {
  const { loc, dir, base, theme } = ctx;
  const t = tr(n.i18n?.title, loc) || n.slug;
  const cat = tr(n.i18n?.category, loc);
  const excerpt = tr(n.i18n?.excerpt, loc);
  const body = tr(n.i18n?.body, loc) || excerpt;      // fall back to the excerpt when body is empty
  // meta description: explicit excerpt, else auto-derived from the article body
  const desc = excerpt || excerptFrom(body);
  // the lead paragraph only shows when the author wrote an explicit excerpt —
  // otherwise the body speaks for itself (no redundant auto-blurb above it)
  const lead = excerpt ? `<p class="adetail__lead">${excerpt}</p>` : "";
  const url = (l) => `${base}${l === "ar" ? "" : "/" + l}/news/${n.slug}.html`;
  const hreflang = ["ar", "en", "zh"].map((l) => `\n<link rel="alternate" hreflang="${l}" href="${url(l)}">`).join("");
  const date = fmtDate((n.published_at || "").slice(0, 10), loc);
  return fill(tmpl, {
    lang: loc, dir, title: t, desc: desc.slice(0, 150),
    canonical: url(loc), hreflang,
    themeHead: theme ? `<link rel="stylesheet" href="${theme.href}"><style id="theme-vars">:root{${theme.vars}}</style>` : "",
    assets: loc === "ar" ? ".." : "../..",
    newsHref: loc === "ar" ? "/news.html" : `/${loc}/news.html`,
    hero: heroHtml(n.image_url || "", t),
    cat, date, lead, body,
    backCta: BACK[loc] || BACK.ar,
  });
}
