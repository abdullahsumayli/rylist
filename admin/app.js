import { signIn, currentUser, isAdmin, sb } from "./db.js";
import { ENTITIES } from "./entities.js";
import { renderProjects } from "./projects.js";
import { renderList } from "./list.js";
import { renderLeads } from "./leads.js";
import { renderPublish } from "./publish.js";
import { mountShell } from "./shell.js";

const loginEl = document.getElementById("login"), appEl = document.getElementById("app");

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await signIn(email.value, password.value);
  document.getElementById("loginErr").textContent = error ? "بيانات غير صحيحة" : "";
  if (!error) boot();
});

async function buildSections() {
  let newLeads = 0;
  try {
    const { count } = await sb.from("leads").select("*", { count: "exact", head: true }).eq("status", "new");
    newLeads = count || 0;
  } catch { /* leads badge is best-effort */ }

  const iconFor = { projects: "projects", news: "news", partners: "partners", stats: "stats", pages: "pages", contact: "contact", social_links: "social", home_content: "home", site_chrome: "pages", site_theme: "pages" };
  const entitySections = ENTITIES.map((e) => ({
    key: e.key, label: e.label, icon: iconFor[e.key] || "pages",
    render: (v) => (e.key === "projects" ? renderProjects(v) : renderList(v, e)),
  }));

  return [
    { key: "leads", label: "الطلبات", icon: "leads", badge: newLeads || null, render: (v) => renderLeads(v) },
    ...entitySections,
    { key: "publish", label: "نشر", icon: "home", render: (v) => renderPublish(v) },
  ];
}

async function boot() {
  const u = await currentUser();
  if (!u || !(await isAdmin())) { appEl.hidden = true; loginEl.hidden = false; return; }
  loginEl.hidden = true; appEl.hidden = false;
  mountShell(u, await buildSections());
}

boot();
