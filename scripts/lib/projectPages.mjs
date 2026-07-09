import fs from "node:fs";
const CTA = { ar:"استفسر عبر واتساب", en:"Enquire on WhatsApp", zh:"通过 WhatsApp 咨询" };
const tmpl = fs.readFileSync("templates/project.html","utf8");
const fill = (s,map)=> s.replace(/\{\{(\w+)\}\}/g, (_,k)=> map[k] ?? "");
export function renderProjectPages(out, c, siteUrl){
  const base = siteUrl.replace(/\/$/,"");
  const tax = (kind,key,loc)=> c.taxonomies.find(t=>t.kind===kind&&t.key===key)?.i18n?.label?.[loc] || key;
  for(const L of c.locales){ const loc=L.code; const dir = loc==="ar"?"":`/${loc}`;
    const outDir = `${out}${dir}/projects`; fs.mkdirSync(outDir, { recursive:true });
    for(const p of c.projects){
      const t = p.i18n?.title?.[loc] || p.i18n?.title?.ar || p.code;
      const path = (l)=> `${base}${l==="ar"?"":"/"+l}/projects/${p.code}.html`;
      const hreflang = ["ar","en","zh"].map(l=>`\n<link rel="alternate" hreflang="${l}" href="${path(l)}">`).join("");
      const wa = c.contact?.whatsapp ? `https://wa.me/${c.contact.whatsapp}?text=${encodeURIComponent(`${t} (${p.code})`)}` : "#";
      const html = fill(tmpl, {
        lang:loc, dir:L.dir, title:t, desc:(p.i18n?.description?.[loc]||"").slice(0,150),
        canonical:path(loc), hreflang, assets: loc==="ar"?".":"..", home: loc==="ar"?"/":`/${loc}/`,
        image:p.image_url||"", district:p.i18n?.district?.[loc]||"", typeLabel:tax("property_type",p.type_key,loc),
        cityLabel:tax("city",p.city_key,loc),
        price: p.price_min? `${p.price_min.toLocaleString()} – ${(p.price_max||p.price_min).toLocaleString()} ${loc==="en"?"SAR":"ريال"}`:"",
        description:p.i18n?.description?.[loc]||"", whatsapp:wa, cta:CTA[loc]||CTA.ar,
      });
      fs.writeFileSync(`${outDir}/${p.code}.html`, "<!doctype html>\n"+html);
    }
  }
}
