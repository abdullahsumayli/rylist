import { sb } from "./db.js";
const STAT=["new","contacted","closed"], AR={new:"جديد",contacted:"تم التواصل",closed:"مغلق"};
export async function renderLeads(root){
  root.innerHTML="<h2>الطلبات الواردة</h2>";
  const { data, error }=await sb.from("leads").select("*").order("created_at",{ascending:false});
  if(error){ root.insertAdjacentHTML("beforeend",`<p class="admin-err">${error.message}</p>`); return; }
  const tbl=document.createElement("table"); tbl.className="admin-tbl";
  tbl.innerHTML="<tr><th>الاسم</th><th>الجوال</th><th>العقار</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th></tr>";
  (data||[]).forEach(r=>{
    const tr=document.createElement("tr");
    const sel=`<select data-id="${r.id}">${STAT.map(s=>`<option value="${s}" ${s===r.status?"selected":""}>${AR[s]}</option>`).join("")}</select>`;
    tr.innerHTML=`<td>${r.name||""}</td><td>${r.phone||""}</td><td>${r.project_code||""}</td><td>${r.message||""}</td><td>${sel}</td><td>${new Date(r.created_at).toLocaleString("ar")}</td>`;
    tbl.appendChild(tr);
  });
  tbl.addEventListener("change", async(e)=>{ if(e.target.tagName==="SELECT"){
    await sb.from("leads").update({status:e.target.value}).eq("id", e.target.dataset.id); }});
  root.appendChild(tbl);
}
