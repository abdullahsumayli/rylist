import { signOut } from "./db.js";

// 24x24 stroke icon paths (from the approved mockup)
const ICONS = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  leads:'<path d="M4 4h16v4H4z"/><path d="M4 12h16v8H4z"/>',
  projects:'<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M10 21v-6h4v6"/>',
  news:'<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>',
  partners:'<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5"/><circle cx="17" cy="9" r="2"/>',
  stats:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  pages:'<path d="M4 4h16v16H4z"/><path d="M4 9h16"/>',
  contact:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  social:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
};
const icon = (k) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${ICONS[k] || ICONS.pages}</svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// sections: [{ key, label, icon, badge?, render(viewEl) }]  (key "publish" is the bottom button, not a nav item)
export function mountShell(user, sections) {
  const side = document.getElementById("side");
  const topbar = document.getElementById("topbar");
  const view = document.getElementById("view");
  const navItems = sections.filter((s) => s.key !== "publish");

  side.innerHTML = `
    <div class="brand"><div class="mark">R</div><div><div class="wm">RYLIST</div><div class="sub">لوحة التحكم</div></div></div>
    <div class="navlbl">القسم</div>
    <nav class="nav" id="nav">${navItems.map((s) => `
      <a href="#${s.key}" data-key="${s.key}">${icon(s.icon)}<span>${esc(s.label)}</span>${s.badge != null ? `<span class="badge num">${esc(s.badge)}</span>` : ""}</a>`).join("")}
    </nav>
    <div class="foot">
      <button class="publish" id="pubBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>نشر الموقع</button>
      <div class="whoami"><span class="av">${esc((user?.email || "?")[0].toUpperCase())}</span><span>${esc(user?.email || "")}</span></div>
      <button class="btn" id="outBtn" style="width:100%">خروج</button>
    </div>`;

  const nav = document.getElementById("nav");

  function route(key) {
    const s = sections.find((x) => x.key === key) || navItems[0];
    [...nav.children].forEach((a) => a.classList.toggle("active", a.dataset.key === s.key));
    topbar.innerHTML = `<div class="crumb">RYLIST · <b>${esc(s.label)}</b></div>`;
    view.innerHTML = "";
    if (location.hash !== "#" + s.key) history.replaceState(null, "", "#" + s.key);
    Promise.resolve(s.render(view)).catch((err) => {
      view.innerHTML = `<p class="admin-err">تعذّر تحميل القسم: ${esc(err?.message || err)}</p>`;
    });
  }

  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    route(a.dataset.key);
  });
  document.getElementById("pubBtn").onclick = () => route("publish");
  document.getElementById("outBtn").onclick = async () => { await signOut(); location.reload(); };

  const initial = (location.hash || "").slice(1);
  route(navItems.some((s) => s.key === initial) ? initial : navItems[0].key);
}
