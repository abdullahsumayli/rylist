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
      const galTitle = {ar:"معرض المشروع",en:"Project gallery",zh:"项目图库"}[loc]||"معرض المشروع";
      const gimgs = Array.isArray(p.gallery)?p.gallery:[];
      const gallery = gimgs.length ? (
        `<section class="pgallery"><h2>${galTitle}</h2><div class="pgallery__grid">`+
        gimgs.map((u,i)=>`<a class="pgallery__cell" href="#g-${p.code}-${i}"><img loading="lazy" src="${u}" alt="${t} ${i+1}"></a>`).join("")+
        `</div>`+
        gimgs.map((u,i)=>`<div class="pgallery__lb" id="g-${p.code}-${i}"><a class="pgallery__bg" href="#"></a><img src="${u}" alt=""><a class="pgallery__x" href="#" aria-label="إغلاق">×</a></div>`).join("")+
        `</section>`) : "";
      const D = p.details || {};
      const tr = (o)=> (o && (o[loc] || o.ar)) || "";
      const H = {facts:{ar:"تفاصيل المشروع",en:"Project details"},units:{ar:"أنواع الوحدات",en:"Unit types"},feat:{ar:"المزايا والمرافق",en:"Features & amenities"},loc:{ar:"الموقع والمعالم القريبة",en:"Location & nearby"}};
      const factsHtml = (D.facts||[]).map(f=>`<div class="pfact"><span class="pfact__k">${tr(f.label)}</span><span class="pfact__v">${tr(f.value)}</span></div>`).join("");
      const unitsHtml = (D.unitTypes||[]).map(u=>`<div class="punit"><h3>${tr(u.title)}</h3><p>${tr(u.detail)}</p></div>`).join("");
      const featHtml = (D.features||[]).map(x=>`<li>${tr(x)}</li>`).join("");
      const locHtml = (D.location||[]).map(x=>`<li>${tr(x)}</li>`).join("");
      const details =
        (factsHtml ? `<section class="psec"><h2>${tr(H.facts)}</h2><div class="pfacts">${factsHtml}</div></section>` : "") +
        (unitsHtml ? `<section class="psec"><h2>${tr(H.units)}</h2><div class="punits">${unitsHtml}</div></section>` : "") +
        (featHtml ? `<section class="psec"><h2>${tr(H.feat)}</h2><ul class="pfeatures">${featHtml}</ul></section>` : "") +
        (locHtml ? `<section class="psec"><h2>${tr(H.loc)}</h2><ul class="plocation">${locHtml}</ul></section>` : "");
      const html = fill(tmpl, {
        lang:loc, dir:L.dir, title:t, desc:(p.i18n?.description?.[loc]||"").slice(0,150),
        canonical:path(loc), hreflang, assets: loc==="ar"?"..":"../..", home: loc==="ar"?"/":`/${loc}/`,
        image:p.image_url||"", district:p.i18n?.district?.[loc]||"", typeLabel:tax("property_type",p.type_key,loc),
        cityLabel:tax("city",p.city_key,loc),
        price: p.price_min? `${p.price_min.toLocaleString()} – ${(p.price_max||p.price_min).toLocaleString()} ${loc==="en"?"SAR":"ريال"}` : ({ar:"السعر عند الطلب",en:"Price on request",zh:"价格待询"}[loc]||"السعر عند الطلب"),
        description:p.i18n?.description?.[loc]||"", whatsapp:wa, cta:CTA[loc]||CTA.ar, details, gallery,
        statusLabel: ({available:{ar:"متاح",en:"Available",zh:"可售"},reserved:{ar:"محجوز",en:"Reserved",zh:"已预订"},sold:{ar:"مباع",en:"Sold",zh:"已售"},soon:{ar:"قريبًا",en:"Soon",zh:"即将推出"}}[p.status]||{})[loc] || "",
        statusClass: p.status==="sold"?"status-pill--sold":(p.status==="reserved"?"status-pill--reserved":(p.status==="soon"?"status-pill--soon":"")),
      });
      fs.writeFileSync(`${outDir}/${p.code}.html`, "<!doctype html>\n"+html);
    }
  }
}
