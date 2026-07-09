import { sb } from "./db.js";
export function renderPublish(root){
  root.innerHTML="<h2>نشر الموقع</h2><p>يعيد توليد الموقع الثابت من المحتوى الحالي (~دقيقة).</p>";
  const btn=document.createElement("button"); btn.textContent="نشر الآن";
  const msg=document.createElement("p");
  btn.onclick=async()=>{ btn.disabled=true; msg.textContent="جارٍ إطلاق النشر…";
    const { data:{ session } }=await sb.auth.getSession();
    const res=await sb.functions.invoke("publish", { headers:{ Authorization:`Bearer ${session.access_token}` } });
    msg.textContent = res.error ? ("فشل: "+res.error.message) : "تم إطلاق النشر ✅ (يظهر خلال دقيقة).";
    btn.disabled=false;
  };
  root.append(btn, msg);
}
