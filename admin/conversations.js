import { sb } from "./db.js";

// أرشيف محادثات "فهم": قائمة بكل محادثة، وفتح الصف يعرض الحوار كاملاً.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) => { try { return new Date(d).toLocaleString("ar"); } catch { return ""; } };

function fmtPrice(min, max) {
  if (!min && !max) return "";
  const lo = min || max, hi = max || min;
  const f = (x) => Number(x).toLocaleString("en-US");
  return (lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`) + " ريال";
}

function transcriptHtml(transcript) {
  const rows = Array.isArray(transcript) ? transcript : [];
  if (!rows.length) return `<div class="conv-none">لا توجد رسائل في هذه المحادثة.</div>`;
  return rows
    .map((m) => {
      const who = m.role === "user" ? "user" : "assistant";
      const name = m.role === "user" ? "العميل" : "فاهم";
      let cards = "";
      if (Array.isArray(m.properties) && m.properties.length) {
        cards =
          `<div class="conv-cards">` +
          m.properties
            .map((p) => {
              const price = fmtPrice(p.price_min, p.price_max);
              return `<span class="conv-card">${esc(p.code || "")}${p.title ? " · " + esc(p.title) : ""}${price ? " · " + esc(price) : ""}</span>`;
            })
            .join("") +
          `</div>`;
      }
      const text = m.content ? `<div class="conv-text">${esc(m.content)}</div>` : "";
      return `<div class="conv-msg conv-msg--${who}"><div class="conv-who">${name}</div>${text}${cards}</div>`;
    })
    .join("");
}

export async function renderConversations(root) {
  root.innerHTML = `<div class="pagehead"><div class="ttl">
      <h1>المحادثات</h1><p>محادثات العملاء مع فاهم — اضغط أي صف لقراءة الحوار كاملاً.</p></div></div>`;

  const { data, error } = await sb
    .from("fahem_conversations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { root.insertAdjacentHTML("beforeend", `<p class="admin-err">${esc(error.message)}</p>`); return; }

  // الجدول "إضافة فقط": عدّة صفوف لكل محادثة. نجمع حسب session_id ونأخذ الأكمل
  // (أكبر msg_count)، مع became_lead/phone كتجميع عبر صفوف المحادثة.
  const bySession = new Map();
  for (const r of data || []) {
    const cur = bySession.get(r.session_id);
    if (!cur) {
      bySession.set(r.session_id, { ...r });
    } else {
      if ((r.msg_count || 0) > (cur.msg_count || 0)) {
        bySession.set(r.session_id, { ...r, became_lead: cur.became_lead || r.became_lead, phone: cur.phone || r.phone });
      } else {
        cur.became_lead = cur.became_lead || r.became_lead;
        cur.phone = cur.phone || r.phone;
      }
    }
  }
  // أحدث نشاط أولاً (created_at للصف الأكمل تنازليًا — والاستعلام أصلًا مرتّب تنازليًا).
  const rows = [...bySession.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!rows.length) {
    root.insertAdjacentHTML("beforeend", `<div class="mocknote">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>
      لا توجد محادثات بعد — ستظهر هنا فور بدء أول عميل محادثة مع فاهم.</div>`);
    return;
  }

  const tbl = document.createElement("table");
  tbl.className = "admin-tbl conv-tbl";
  tbl.innerHTML =
    "<tr><th>التاريخ</th><th>اللغة</th><th>الرسائل</th><th>أول سؤال</th><th>الطلب</th></tr>";

  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "conv-row";
    const lead = r.became_lead
      ? `<span class="conv-lead">↩ طلب${r.phone ? " · " + esc(r.phone) : ""}</span>`
      : `<span class="conv-nolead">—</span>`;
    tr.innerHTML =
      `<td>${esc(fmtDate(r.created_at))}</td>` +
      `<td>${r.lang === "en" ? "EN" : "ع"}</td>` +
      `<td class="num">${esc(r.msg_count)}</td>` +
      `<td class="conv-first">${esc(r.first_message)}</td>` +
      `<td>${lead}</td>`;

    const detail = document.createElement("tr");
    detail.className = "conv-detail";
    detail.hidden = true;
    detail.innerHTML = `<td colspan="5"><div class="conv-thread">${transcriptHtml(r.transcript)}</div></td>`;

    tr.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
      tr.classList.toggle("open", !detail.hidden);
    });

    tbl.appendChild(tr);
    tbl.appendChild(detail);
  });

  root.appendChild(tbl);
}
