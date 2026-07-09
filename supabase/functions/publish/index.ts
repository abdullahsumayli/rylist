import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type",
  };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type":"application/json" } });
  if(req.method==="OPTIONS") return new Response("ok",{ headers:cors });

  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global:{ headers:{ Authorization:auth } } });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if(isAdmin !== true) return json({ error:"unauthorized" }, 401);

  const hook = Deno.env.get("VERCEL_DEPLOY_HOOK");
  if(!hook) return json({ error:"deploy hook not set" }, 500);

  // Actually verify the deploy hook fired — otherwise a dead/misconfigured hook
  // would return success and the site would silently never rebuild.
  let r: Response;
  try {
    r = await fetch(hook, { method:"POST" });
  } catch (e) {
    return json({ error:"deploy hook unreachable", detail:String(e) }, 502);
  }
  const bodyText = await r.text().catch(() => "");
  if(!r.ok) return json({ error:"deploy hook rejected the request", hookStatus:r.status, hookBody:bodyText.slice(0,300) }, 502);

  let job: { id?: string; state?: string } | undefined;
  try { const p = JSON.parse(bodyText); if(p?.job) job = { id: p.job.id, state: p.job.state }; } catch { /* non-JSON hook response is still a 2xx success */ }
  return json({ ok:true, hookStatus:r.status, job });
});
