import { sb } from "./db.js";
import { renderForm } from "./fields.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const get = (row, path) => path.split(".").reduce((o, k) => o?.[k], row);

// generic table list for non-project entities (news, partners, stats, pages, contact, social)
export async function renderList(root, ent) {
  const pk = ent.pk || "id";
  root.innerHTML = `<div class="pagehead">
      <div class="ttl"><h1>${esc(ent.label)}</h1></div>
      <div class="actions">${ent.single ? "" : `<button class="btn btn-primary" id="addBtn">+ إضافة</button>`}</div>
    </div>`;
  if (!ent.single) {
    root.querySelector("#addBtn").onclick = () => renderForm(root, ent, {}, () => renderList(root, ent));
  }

  const { data, error } = await sb.from(ent.table).select("*").order(ent.order, { ascending: true });
  if (error) { root.insertAdjacentHTML("beforeend", `<p class="admin-err">${esc(error.message)}</p>`); return; }
  const rows = data || [];
  if (!rows.length) { root.insertAdjacentHTML("beforeend", `<p class="muted">لا توجد عناصر بعد.</p>`); return; }

  const tbl = document.createElement("table"); tbl.className = "admin-tbl";
  tbl.innerHTML = `<tr><th>العنوان / المعرّف</th><th></th></tr>`;
  rows.forEach((row) => {
    const title = ent.title.startsWith("i18n.")
      ? (get(row, ent.title)?.ar || "—")
      : (row[ent.title.replace("i18n.", "")] ?? row[pk]);
    const tr = document.createElement("tr");
    const td1 = document.createElement("td"); td1.textContent = title; tr.appendChild(td1);
    const td2 = document.createElement("td");
    const edit = document.createElement("button"); edit.className = "btn"; edit.textContent = "تعديل";
    edit.onclick = () => renderForm(root, ent, row, () => renderList(root, ent));
    td2.appendChild(edit);
    if (!ent.single) {
      const del = document.createElement("button"); del.className = "btn"; del.textContent = "حذف"; del.style.marginInlineStart = "6px";
      del.onclick = async () => {
        if (!confirm("حذف؟")) return;
        const { error: e2 } = await sb.from(ent.table).delete().eq(pk, row[pk]);
        if (e2) { alert(e2.message); return; }
        renderList(root, ent);
      };
      td2.appendChild(del);
    }
    tr.appendChild(td2); tbl.appendChild(tr);
  });
  root.appendChild(tbl);
}
