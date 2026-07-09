import { sb } from "./db.js";

const STAT = ["new", "contacted", "closed"], AR = { new: "جديد", contacted: "تم التواصل", closed: "مغلق" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function renderLeads(root) {
  root.innerHTML = `<div class="pagehead"><div class="ttl">
      <h1>الطلبات الواردة</h1><p>طلبات العملاء من نموذج الموقع — غيّر الحالة عند المتابعة.</p></div></div>`;

  const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false });
  if (error) { root.insertAdjacentHTML("beforeend", `<p class="admin-err">${esc(error.message)}</p>`); return; }
  const rows = data || [];

  if (!rows.length) {
    root.insertAdjacentHTML("beforeend", `<div class="mocknote">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H5l-1 4z"/></svg>
      لا توجد طلبات بعد — ستظهر هنا فور إرسال أول عميل النموذج في الموقع.</div>`);
    return;
  }

  const tbl = document.createElement("table"); tbl.className = "admin-tbl";
  tbl.innerHTML = "<tr><th>الاسم</th><th>الجوال</th><th>العقار</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th></tr>";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const sel = `<select data-id="${esc(r.id)}">${STAT.map((s) => `<option value="${s}" ${s === r.status ? "selected" : ""}>${AR[s]}</option>`).join("")}</select>`;
    tr.innerHTML = `<td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(r.project_code)}</td><td>${esc(r.message)}</td><td>${sel}</td><td>${esc(new Date(r.created_at).toLocaleString("ar"))}</td>`;
    tbl.appendChild(tr);
  });
  tbl.addEventListener("change", async (e) => {
    if (e.target.tagName === "SELECT") {
      await sb.from("leads").update({ status: e.target.value }).eq("id", e.target.dataset.id);
    }
  });
  root.appendChild(tbl);
}
