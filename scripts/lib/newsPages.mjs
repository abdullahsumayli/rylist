import fs from "node:fs";
import { renderArticleHtml } from "./renderArticle.mjs";
import { resolveTheme } from "./theme.mjs";
import { buildFooter } from "./footerPartial.mjs";
import { pageContent } from "./pageContent.mjs";

const tmpl = fs.readFileSync("templates/article.html", "utf8");

export function renderNewsPages(out, c, siteUrl) {
  const base = siteUrl.replace(/\/$/, "");
  const theme = resolveTheme(c.theme || {});
  const content = pageContent(c);
  for (const L of c.locales) {
    const loc = L.code;
    const urlDir = loc === "ar" ? "" : `/${loc}`;
    const outDir = `${out}${urlDir}/news`;
    fs.mkdirSync(outDir, { recursive: true });
    const footer = buildFooter({ locale: loc, contact: c.contact, content });
    for (const n of c.news) {
      if (!n.slug) continue;
      const html = renderArticleHtml(tmpl, n, { loc, dir: L.dir, base, theme, footer });
      fs.writeFileSync(`${outDir}/${n.slug}.html`, html);   // template already leads with <!doctype html>
    }
  }
}
