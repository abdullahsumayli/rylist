import fs from "node:fs"; import { parse } from "node-html-parser";
const PAGES = ["index.html","projects.html","services.html","about.html","news.html","contact.html"];

function localizeHtml(html, locale, dir, siteUrl, pageName){
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
  }
  // hreflang + canonical
  const head = root.querySelector("head");
  const base = siteUrl.replace(/\/$/,"");
  const url = (loc)=> loc==="ar" ? `${base}/${pageName}` : `${base}/${loc}/${pageName}`;
  head.insertAdjacentHTML("beforeend", `\n<link rel="canonical" href="${url(locale)}">`);
  ["ar","en","zh"].forEach(l=> head.insertAdjacentHTML("beforeend", `\n<link rel="alternate" hreflang="${l}" href="${url(l)}">`));
  return "<!doctype html>\n"+root.toString();
}

export function renderPages(out, c, siteUrl){
  const locales = c.locales; // مفعّلة فقط
  for(const page of PAGES){
    if(!fs.existsSync(page)) continue;
    const src = fs.readFileSync(page, "utf8");
    for(const L of locales){
      const dir = L.code==="ar" ? "" : `/${L.code}`;
      const outDir = out + dir; fs.mkdirSync(outDir, { recursive:true });
      fs.writeFileSync(`${outDir}/${page}`, localizeHtml(src, L.code, L.dir, siteUrl, page));
    }
  }
}
