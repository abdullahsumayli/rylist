import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, content-type" };
  if(req.method==="OPTIONS") return new Response("ok",{ headers:cors });
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global:{ headers:{ Authorization:auth } } });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if(isAdmin !== true) return new Response(JSON.stringify({ error:"unauthorized" }), { status:401, headers:cors });
  const hook = Deno.env.get("VERCEL_DEPLOY_HOOK");
  if(!hook) return new Response(JSON.stringify({ error:"deploy hook not set" }), { status:500, headers:cors });
  await fetch(hook, { method:"POST" });
  return new Response(JSON.stringify({ ok:true }), { headers:cors });
});
