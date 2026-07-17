// notify-lead — يُستدعى من Database Webhook عند إدراج صفّ جديد في جدول leads،
// فيرسل إيميل تنبيه إلى فريق RYLIST عبر Resend.
//
// الأسرار المطلوبة (تُضبط في لوحة Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY    مفتاح Resend (إلزامي)
//   WEBHOOK_SECRET    سرّ مشترك يطابق ترويسة x-webhook-secret في الـtrigger (إلزامي)
//   LEAD_NOTIFY_TO    إيميل الوجهة (اختياري، الافتراضي info@rylist.sa)
//   LEAD_NOTIFY_FROM  عنوان المُرسِل (اختياري، الافتراضي نطاق Resend التجريبي)

interface Lead {
  id?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  project_code?: string | null;
  message?: string | null;
  source?: string | null;
  status?: string | null;
  locale?: string | null;
  created_at?: string | null;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const row = (label: string, value: unknown, extra = "") => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return `<tr>
    <td style="padding:8px 14px;color:#6B6152;font-size:13px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
    <td style="padding:8px 14px;color:#17140F;font-size:15px">${extra || esc(value)}</td>
  </tr>`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  // مصادقة: يجب أن تطابق الترويسة السرّ المضبوط في البيئة (fail-closed).
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret) return new Response(JSON.stringify({ error: "WEBHOOK_SECRET not set" }), { status: 500 });
  if (req.headers.get("x-webhook-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });

  const to = Deno.env.get("LEAD_NOTIFY_TO") || "info@rylist.sa";
  const from = Deno.env.get("LEAD_NOTIFY_FROM") || "RYLIST <onboarding@resend.dev>";

  let body: { record?: Lead; type?: string; table?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const lead: Lead = body.record ?? {};
  if (!lead.name && !lead.phone && !lead.message) {
    return new Response(JSON.stringify({ error: "empty lead" }), { status: 400 });
  }

  const when = lead.created_at
    ? new Date(lead.created_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
    : "";
  const phoneLink = lead.phone
    ? `<a href="tel:${esc(String(lead.phone).replace(/\s/g, ""))}" style="color:#86713F">${esc(lead.phone)}</a>`
    : "";
  const emailLink = lead.email ? `<a href="mailto:${esc(lead.email)}" style="color:#86713F">${esc(lead.email)}</a>` : "";
  const msgHtml = lead.message ? esc(lead.message).replaceAll("\n", "<br>") : "";

  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F6F3EB;padding:24px;font-family:'Segoe UI',Tahoma,Arial,sans-serif">
    <table style="max-width:560px;margin:0 auto;background:#FBF9F4;border:1px solid rgba(23,20,15,0.12);border-radius:6px;overflow:hidden;border-collapse:collapse;width:100%">
      <tr><td style="background:#17140F;color:#F6F3EB;padding:18px 22px;font-size:16px">
        طلب استشارة جديد · <strong>RYLIST</strong>
      </td></tr>
      <tr><td style="padding:10px 8px">
        <table style="width:100%;border-collapse:collapse">
          ${row("الاسم", lead.name)}
          ${row("الجوال", lead.phone, phoneLink)}
          ${row("البريد", lead.email, emailLink)}
          ${row("الاهتمام", lead.project_code)}
          ${row("الرسالة", lead.message, msgHtml)}
          ${row("المصدر", lead.source)}
          ${row("اللغة", lead.locale)}
          ${row("التاريخ", when)}
        </table>
      </td></tr>
      <tr><td style="background:#EFEBE0;color:#6B6152;padding:12px 22px;font-size:12px">
        وصلك هذا التنبيه لأن طلبًا جديدًا سُجّل في موقع RYLIST.
      </td></tr>
    </table>
  </body></html>`;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `طلب استشارة جديد${lead.name ? " — " + lead.name : ""}`,
      html,
      ...(lead.email ? { reply_to: lead.email } : {}),
    }),
  });

  const resendBody = await resendRes.text().catch(() => "");
  if (!resendRes.ok) {
    return new Response(JSON.stringify({ error: "resend failed", status: resendRes.status, detail: resendBody.slice(0, 400) }), { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
