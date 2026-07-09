import fs from "node:fs"; import path from "node:path";
import { fetchContent } from "./lib/fetchContent.mjs";
import { writeDataJs } from "./lib/dataJs.mjs";
import { renderPages } from "./lib/renderPages.mjs";
import { renderProjectPages } from "./lib/projectPages.mjs";
import { writeSitemap } from "./lib/sitemap.mjs";

const OUT = "dist";
const SITE = process.env.SITE_URL || "https://rylist.sa";

async function main(){
  const c = await fetchContent();
  fs.rmSync(OUT, { recursive:true, force:true }); fs.mkdirSync(OUT, { recursive:true });
  // انسخ الأصول الثابتة
  for(const p of ["assets","favicon.svg","robots.txt",".nojekyll"]) if(fs.existsSync(p)) fs.cpSync(p, path.join(OUT,p), { recursive:true });
  writeDataJs(OUT, c);
  renderPages(OUT, c, SITE);
  renderProjectPages(OUT, c, SITE);
  writeSitemap(OUT, c, SITE);
  console.log("Build done →", OUT);
}
main().catch(e=>{ console.error(e); process.exit(1); });
