import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://ghtcwsbtyvczlznviojj.supabase.co", SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGN3c2J0eXZjemx6bnZpb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NTA2NjMsImV4cCI6MjA5OTEyNjY2M30.dv4RFD_e3vfRFFMPTZFaVAYZARTzELgOccSew8rLZXc";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const lang = document.documentElement.lang || "ar";

// (١) نموذج الطلبات → INSERT في leads
const form = document.getElementById("interestForm");
if(form) form.addEventListener("submit", async (e)=>{
  e.preventDefault(); const d = new FormData(form);
  const { error } = await sb.from("leads").insert({
    name:d.get("name"), phone:d.get("phone"), email:d.get("email"),
    project_code:d.get("interest"), message:d.get("message"), source:"form", locale:lang });
  const msg=document.getElementById("formMsg");
  if(msg) msg.textContent = error
    ? (lang==="ar" ? "تعذّر الإرسال، حاول مجددًا" : "Couldn’t send, please try again")
    : (lang==="ar" ? "تم استلام طلبك ✅" : "Your request has been received ✅");
  if(!error) form.reset();
});

// (٢) مبدّل اللغة = روابط حقيقية بين نسخ اللغة
document.querySelectorAll("[data-lang-link]").forEach(a=>{
  const target=a.getAttribute("data-lang-link"); // "ar" | "en" | "zh"
  const p=location.pathname.replace(/^\/(en|zh)\//,"/"); // المسار بلا بادئة لغة
  a.href = target==="ar" ? p : `/${target}${p}`;
});

// (٣) أيقونة واتساب العائمة
document.querySelectorAll("[data-wa-float]").forEach(a=>a.href="https://wa.me/"+(window.RYLIST_DATA?.contact?.whatsapp||""));

// (٤) روابط السوشيال في الفوتر
const s=document.getElementById("social");
if(s && window.RYLIST_DATA?.social) s.innerHTML = window.RYLIST_DATA.social.map(x=>`<a href="${x.url}" target="_blank" rel="noopener">${x.platform}</a>`).join(" · ");
