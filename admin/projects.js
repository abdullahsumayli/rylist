import { sb } from "./db.js";
import { ENTITIES } from "./entities.js";
import { renderForm } from "./fields.js";
import { renderProjectContent } from "./content.js";

const AR = "٠١٢٣٤٥٦٧٨٩";
const ar = (n) => String(n ?? 0).replace(/[0-9]/g, (d) => AR[+d]);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ST = { available: { t: "متاح", c: "available" }, reserved: { t: "محجوز", c: "reserved" }, sold: { t: "مباع", c: "sold" } };
const ENT = () => ENTITIES.find((e) => e.key === "projects");
const money = (n) => { if (!n) return ""; const m = n / 1e6, s = (Math.round(m * 10) / 10).toFixed(1).replace(/\.0$/, ""); return ar(s); };

export async function renderProjects(root) {
  const [{ data, error }, { data: tax }] = await Promise.all([
    sb.from("projects").select("*").order("sort_order", { ascending: true }),
    sb.from("taxonomies").select("*"),
  ]);
  if (error) { root.innerHTML = `<p class="admin-err">${esc(error.message)}</p>`; return; }
  const rows = data || [];
  const label = (kind, key) => (tax || []).find((t) => t.kind === kind && t.key === key)?.i18n?.label?.ar || key;
  const count = (s) => rows.filter((r) => r.status === s).length;

  root.innerHTML = `
    <div class="pagehead">
      <div class="ttl"><h1>العقارات</h1><p>قائمة عقارات مكتبك — تُعرض للعملاء ويُبنى لكل عقار صفحته عند النشر.</p></div>
      <div class="actions">
        <button class="btn" id="importBtn" title="قريبًا"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>رفع من ملف</button>
        <button class="btn btn-primary" id="addBtn"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>إضافة عقار</button>
      </div>
    </div>
    <div class="countline">إجمالي <b>${ar(rows.length)}</b> عقارات</div>
    <div class="stats">
      <div class="stat total"><div class="lab">كل العقارات</div><div class="val num">${ar(rows.length)}</div></div>
      <div class="stat avail"><div class="lab"><span class="dot"></span>متاح</div><div class="val num">${ar(count("available"))}</div></div>
      <div class="stat res"><div class="lab"><span class="dot"></span>محجوز</div><div class="val num">${ar(count("reserved"))}</div></div>
      <div class="stat sold"><div class="lab"><span class="dot"></span>مباع</div><div class="val num">${ar(count("sold"))}</div></div>
    </div>
    <div class="toolbar">
      <div class="searchbox"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input id="q" placeholder="ابحث في العنوان أو الحي أو الكود…"></div>
      <div class="filters" id="filters">
        <button class="chip on" data-f="all">الكل <span class="n num">${ar(rows.length)}</span></button>
        <button class="chip" data-f="available">متاح <span class="n num">${ar(count("available"))}</span></button>
        <button class="chip" data-f="reserved">محجوز <span class="n num">${ar(count("reserved"))}</span></button>
        <button class="chip" data-f="sold">مباع <span class="n num">${ar(count("sold"))}</span></button>
      </div>
    </div>
    <div class="grid" id="grid"></div>`;

  const grid = root.querySelector("#grid");
  const card = (p) => {
    const s = ST[p.status] || ST.available;
    const title = p.i18n?.title?.ar || p.code;
    const dist = p.i18n?.district?.ar || "";
    const beds = p.beds_min ? `<span class="tag">${ar(p.beds_min)}–${ar(p.beds_max)} غرف</span>` : "";
    const price = p.price_min ? `<div class="price">${money(p.price_min)} – ${money(p.price_max || p.price_min)} <span class="u">مليون ر.س</span></div>` : "";
    const media = p.image_url
      ? `<img src="${esc(p.image_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
      : `<div class="pat"></div>`;
    return `<article class="card" data-status="${p.status}" data-txt="${esc((title + " " + dist + " " + p.code).toLowerCase())}">
      <div class="ph">${media}<span class="code">${esc(p.code)}</span>${p.featured ? '<span class="star">★</span>' : ""}
        <span class="badge ${s.c}"><span class="d"></span>${s.t}</span></div>
      <div class="bd"><h3>${esc(title)}</h3>
        <div class="loc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>${dist ? esc(dist) + " · " : ""}${esc(label("city", p.city_key))}</div>
        <div class="metar"><span class="tag">${esc(label("property_type", p.type_key))}</span>${beds}</div>
        ${price}
        <div class="prog"><div class="rowb"><span>نسبة البيع</span><span class="num">${ar(p.sold || 0)}٪</span></div>
          <div class="bar"><div class="fill" style="width:${Number(p.sold) || 0}%"></div></div></div>
        <div class="cta"><button class="mini" data-edit="${esc(p.id)}">تعديل</button>
          <button class="mini" data-content="${esc(p.id)}">المحتوى</button>
          <button class="mini" data-del="${esc(p.id)}">حذف</button></div>
      </div></article>`;
  };
  grid.innerHTML = rows.length ? rows.map(card).join("") : `<p class="muted">لا توجد عقارات بعد. اضغط «إضافة عقار» للبدء.</p>`;

  // client-side filter + search
  let flt = "all", q = "";
  const apply = () => {
    [...grid.children].forEach((c) => {
      if (!c.dataset.status) return;
      const okF = flt === "all" || c.dataset.status === flt;
      const okQ = !q || (c.dataset.txt || "").includes(q);
      c.style.display = okF && okQ ? "" : "none";
    });
  };
  root.querySelector("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    root.querySelectorAll("#filters .chip").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); flt = b.dataset.f; apply();
  });
  root.querySelector("#q").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); apply(); });

  // actions
  root.querySelector("#addBtn").onclick = () => renderForm(root, ENT(), {}, () => renderProjects(root));
  root.querySelector("#importBtn").onclick = () => alert("رفع العقارات من ملف Excel/CSV — قريبًا (الجزء ج).");
  grid.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]"), ct = e.target.closest("[data-content]");
    if (ed) { const row = rows.find((r) => String(r.id) === ed.dataset.edit); renderForm(root, ENT(), row, () => renderProjects(root)); }
    if (ct) { const row = rows.find((r) => String(r.id) === ct.dataset.content); renderProjectContent(root, row, () => renderProjects(root)); }
    if (dl) { if (!confirm("حذف العقار؟")) return; const { error: e2 } = await sb.from("projects").delete().eq("id", dl.dataset.del); if (e2) { alert(e2.message); return; } renderProjects(root); }
  });
}
