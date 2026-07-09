import { createClient } from "@supabase/supabase-js";
export async function fetchContent(){
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const grab = async (t, order)=> (await sb.from(t).select("*").order(order,{ascending:true})).data || [];
  const [locales, taxonomies, projects, news, partners, stats, social] = await Promise.all([
    grab("locales","sort_order"), grab("taxonomies","sort_order"),
    grab("projects","sort_order"),
    (await sb.from("news").select("*").eq("status","published").order("published_at",{ascending:false})).data||[],
    grab("partners","sort_order"), grab("stats","sort_order"), grab("social_links","sort_order"),
  ]);
  const contact = (await sb.from("contact").select("*").eq("id",1).single()).data || {};
  const pages = Object.fromEntries(((await sb.from("pages").select("*")).data||[]).map(p=>[p.key,p.i18n]));
  return { locales: locales.filter(l=>l.enabled), taxonomies, projects, news, partners, stats,
           social: social.filter(s=>s.enabled), contact, pages };
}
