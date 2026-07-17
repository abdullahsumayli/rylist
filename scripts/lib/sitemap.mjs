import fs from "node:fs";
export function writeSitemap(out, c, siteUrl){
  const base = siteUrl.replace(/\/$/,"");
  const pages=["","projects.html","services.html","about.html","news.html","contact.html"];
  const urls=[];
  for(const L of c.locales){ const pre = L.code==="ar"?"":`/${L.code}`;
    for(const pg of pages) urls.push(`${base}${pre}/${pg}`);
    for(const p of c.projects) urls.push(`${base}${pre}/projects/${p.code}.html`);
    for(const n of (c.news||[])) if(n.slug) urls.push(`${base}${pre}/news/${n.slug}.html`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map(u=>`<url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`;
  fs.writeFileSync(out+"/sitemap.xml", xml);
}
