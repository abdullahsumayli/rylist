import fs from "node:fs";
export function writeDataJs(out, c){
  const data = {
    locales: c.locales, taxonomies: c.taxonomies, projects: c.projects,
    news: c.news, partners: c.partners, stats: c.stats, contact: c.contact, social: c.social,
  };
  fs.mkdirSync(out+"/assets/js", { recursive:true });
  fs.writeFileSync(out+"/assets/js/data.js", "window.RYLIST_DATA = "+JSON.stringify(data)+";\n");
}
