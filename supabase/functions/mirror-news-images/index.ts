import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ينقل صور المقالات من مواقع خارجية (pexels / unsplash …) إلى تخزين المشروع.
//
// ليش: الصورة المستضافة عند غيرنا ليست ملكنا — قد تُحذف أو يتغير رابطها أو
// يُمنع الوصول إليها، فتُكسر صورة المقال بلا إنذار. وتحميلها من نطاق آخر يسرّب
// زيارات قرّائنا لطرف ثالث. المطلوب أن كل صورة تظهر على الموقع مستضافة عندنا.
//
// لا تأخذ أي رابط من المتصل: تعمل فقط على الروابط المحفوظة أصلًا في قاعدة
// البيانات (كتبها الأدمن)، فلا مجال لاستغلالها لجلب عناوين داخلية.
// عملية مكرَّرة الأمان: الصورة المنقولة سابقًا تُتخطّى، فإعادة التشغيل بلا أثر.

const MAX_BYTES = 15 * 1024 * 1024;      // سقف حجم الصورة الواحدة
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/avif": "avif", "image/gif": "gif",
};

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") ?? "authorization, x-client-info, apikey, content-type",
  };
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // للأدمن وحده: الدالة تكتب في التخزين وفي قاعدة البيانات بمفتاح الخدمة.
  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: isAdmin } = await asCaller.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "unauthorized" }, 401);

  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ownPrefix = `${url}/storage/v1/object/public/`;

  const { data: rows, error } = await service.from("news").select("id,slug,image_url");
  if (error) return json({ error: error.message }, 500);

  const report: Record<string, unknown>[] = [];
  for (const row of (rows || []) as { id: string; slug: string; image_url: string | null }[]) {
    const src = String(row.image_url || "");
    if (!src || src.startsWith(ownPrefix)) { report.push({ slug: row.slug, skipped: "already ours" }); continue; }
    if (!/^https?:\/\//i.test(src)) { report.push({ slug: row.slug, skipped: "not an http url" }); continue; }
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`source returned ${res.status}`);
      const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const ext = EXT[type];
      if (!ext) throw new Error(`unsupported content-type: ${type || "none"}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!bytes.length) throw new Error("empty body");
      if (bytes.length > MAX_BYTES) throw new Error(`too large: ${bytes.length} bytes`);

      const path = `news/${row.slug}-${Date.now()}.${ext}`;
      const up = await service.storage.from("media").upload(path, bytes, { contentType: type, upsert: true });
      if (up.error) throw new Error(`upload failed: ${up.error.message}`);

      const publicUrl = service.storage.from("media").getPublicUrl(path).data.publicUrl;
      const wr = await service.from("news").update({ image_url: publicUrl }).eq("id", row.id);
      if (wr.error) throw new Error(`db update failed: ${wr.error.message}`);

      report.push({ slug: row.slug, moved: true, bytes: bytes.length, type, from: src, to: publicUrl });
    } catch (e) {
      report.push({ slug: row.slug, error: String(e), from: src });
    }
  }
  return json({ ok: true, report });
});
