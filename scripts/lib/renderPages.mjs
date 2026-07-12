import fs from "node:fs"; import { parse } from "node-html-parser";
import { applyContent } from "./applyContent.mjs";
import { resolveTheme } from "./theme.mjs";
const PAGES = ["index.html","projects.html","services.html","about.html","news.html","contact.html"];

function localizeHtml(html, locale, dir, siteUrl, pageName, content, theme){
  const root = parse(html, { comment:true });
  const htmlEl = root.querySelector("html"); htmlEl.setAttribute("lang", locale); htmlEl.setAttribute("dir", dir);
  if(locale !== "ar"){
    root.querySelectorAll(`[data-${locale}]`).forEach(el=>{
      const tag = (el.rawTagName || "").toLowerCase();
      // <meta> carries its text in the `content` attribute, not as children
      if(tag === "meta"){ el.setAttribute("content", el.getAttribute(`data-${locale}`)); }
      else { el.set_content(el.getAttribute(`data-${locale}`)); }
    });
    root.querySelectorAll(`[data-${locale}-ph]`).forEach(el=>{ el.setAttribute("placeholder", el.getAttribute(`data-${locale}-ph`)); });
    // localized pages live under /<locale>/, so root-relative assets must be made absolute
    // (page-to-page links like "projects.html" stay relative and resolve within /<locale>/)
    root.querySelectorAll("[href],[src]").forEach(el=>{
      ["href","src"].forEach(attr=>{
        const v = el.getAttribute(attr);
        if(v && /^(assets\/|favicon\.svg)/.test(v)) el.setAttribute(attr, "/"+v);
      });
    });
  }
  // overlay DB content (after locale swap so DB overrides the per-language default)
  applyContent(root, content, locale);
  // hreflang + canonical
  const head = root.querySelector("head");
  // theme: swap the Google Fonts link + override CSS variables
  const fontLink = head.querySelector('link[href*="fonts.googleapis.com/css2"]');
  if(fontLink && theme?.href) fontLink.setAttribute("href", theme.href);
  if(theme?.vars) head.insertAdjacentHTML("beforeend", `\n<style id="theme-vars">:root{${theme.vars}}</style>`);
  const base = siteUrl.replace(/\/$/,"");
  const url = (loc)=> loc==="ar" ? `${base}/${pageName}` : `${base}/${loc}/${pageName}`;
  head.insertAdjacentHTML("beforeend", `\n<link rel="canonical" href="${url(locale)}">`);
  ["ar","en","zh"].forEach(l=> head.insertAdjacentHTML("beforeend", `\n<link rel="alternate" hreflang="${l}" href="${url(l)}">`));
  return "<!doctype html>\n"+root.toString();
}

export function renderPages(out, c, siteUrl){
  const locales = c.locales; // مفعّلة فقط
  const content = {
    text: { ...(c.home?.i18n || {}), ...(c.chrome?.i18n || {}) },
    heroImage: c.home?.hero_image_url || "",
  };
  const theme = resolveTheme(c.theme || {});
  for(const page of PAGES){
    if(!fs.existsSync(page)) continue;
    const src = fs.readFileSync(page, "utf8");
    for(const L of locales){
      const dir = L.code==="ar" ? "" : `/${L.code}`;
      const outDir = out + dir; fs.mkdirSync(outDir, { recursive:true });
      fs.writeFileSync(`${outDir}/${page}`, localizeHtml(src, L.code, L.dir, siteUrl, page, content, theme));
    }
  }
}
