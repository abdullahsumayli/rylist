import fs from "node:fs";
import { renderProjectHtml } from "./renderProject.mjs";

const tmpl = fs.readFileSync("templates/project.html", "utf8");

export function renderProjectPages(out, c, siteUrl) {
  const base = siteUrl.replace(/\/$/, "");
  const tax = (kind, key, loc) =>
    c.taxonomies.find((t) => t.kind === kind && t.key === key)?.i18n?.label?.[loc] || key;
  for (const L of c.locales) {
    const loc = L.code;
    const urlDir = loc === "ar" ? "" : `/${loc}`;
    const outDir = `${out}${urlDir}/projects`;
    fs.mkdirSync(outDir, { recursive: true });
    for (const p of c.projects) {
      const html = renderProjectHtml(tmpl, p, { loc, dir: L.dir, base, tax, contact: c.contact });
      fs.writeFileSync(`${outDir}/${p.code}.html`, "<!doctype html>\n" + html);
    }
  }
}
