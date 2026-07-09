import { sb, signIn, signOut, currentUser, isAdmin } from "./db.js";
import { ENTITIES } from "./entities.js";
import { renderList } from "./ui.js";
import { renderLeads } from "./leads.js";
import { renderPublish } from "./publish.js";

const loginEl=document.getElementById("login"), appEl=document.getElementById("app");
const navEl=document.getElementById("nav"), viewEl=document.getElementById("view");

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const { error } = await signIn(email.value, password.value);
  document.getElementById("loginErr").textContent = error ? "بيانات غير صحيحة" : "";
  if(!error) boot();
});

async function boot(){
  const u = await currentUser();
  if(!u || !(await isAdmin())){ appEl.hidden=true; loginEl.hidden=false; return; }
  loginEl.hidden=true; appEl.hidden=false;
  buildNav(); route("leads");
}
function buildNav(){
  const items=[["leads","الطلبات"],...ENTITIES.map(e=>[e.key,e.label]),["publish","نشر"]];
  navEl.innerHTML="";
  for(const [key,label] of items){
    const b=document.createElement("button"); b.textContent=label;
    b.onclick=()=>{ [...navEl.children].forEach(c=>c.classList.remove("active")); b.classList.add("active"); route(key); };
    navEl.appendChild(b);
  }
  const out=document.createElement("button"); out.textContent="خروج"; out.onclick=async()=>{ await signOut(); location.reload(); };
  navEl.appendChild(out);
}
function route(key){
  viewEl.innerHTML="";
  if(key==="leads") return renderLeads(viewEl);
  if(key==="publish") return renderPublish(viewEl);
  const ent=ENTITIES.find(e=>e.key===key); if(ent) renderList(viewEl, ent);
}
boot();
