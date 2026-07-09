import { sb } from "./db.js";
import { LOCALES } from "./config.js";
let TAX = null;
async function taxonomy(kind){ if(!TAX){ const {data}=await sb.from("taxonomies").select("*"); TAX=data||[]; }
  return TAX.filter(t=>t.kind===kind).map(t=>({ value:t.key, label:t.i18n?.label?.ar || t.key })); }

const get=(row,path)=> path.split(".").reduce((o,k)=>o?.[k], row);
function localeTabs(field, value, onLocale){
  const wrap=document.createElement("div");
  const tabs=document.createElement("div"); tabs.className="admin-tabs";
  const pane=document.createElement("div");
  let cur=LOCALES[0].code;
  const draw=()=>{ pane.innerHTML="";
    const ta=field.t==="i18n-rich"?document.createElement("textarea"):document.createElement("input");
    if(field.t==="i18n-rich") ta.rows=6;
    ta.value=(value&&value[cur])||""; ta.oninput=()=>onLocale(cur, ta.value); pane.appendChild(ta); };
  LOCALES.forEach(L=>{ const b=document.createElement("button"); b.type="button"; b.textContent=L.name;
    if(L.code===cur)b.classList.add("active");
    b.onclick=()=>{ cur=L.code; [...tabs.children].forEach(c=>c.classList.remove("active")); b.classList.add("active"); draw(); };
    tabs.appendChild(b); });
  wrap.append(tabs, pane); draw(); return wrap;
}

export async function renderList(root, ent){
  root.innerHTML=`<h2>${ent.label}</h2>`;
  const addBtn=document.createElement("button"); addBtn.textContent="+ إضافة";
  addBtn.onclick=()=>renderForm(root, ent, {}); root.appendChild(addBtn);
  const { data, error } = await sb.from(ent.table).select("*").order(ent.order, { ascending:true });
  if(error){ root.insertAdjacentHTML("beforeend", `<p class="admin-err">${error.message}</p>`); return; }
  const tbl=document.createElement("table"); tbl.className="admin-tbl";
  tbl.innerHTML=`<tr><th>العنوان/المعرّف</th><th></th></tr>`;
  (data||[]).forEach(row=>{
    const title = ent.title.startsWith("i18n.") ? (get(row, ent.title)?.ar || "—") : (row[ent.title.replace("i18n.","")] ?? row[ent.pk||"id"]);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${title}</td>`;
    const td=document.createElement("td");
    const edit=document.createElement("button"); edit.textContent="تعديل"; edit.onclick=()=>renderForm(root, ent, row);
    const del=document.createElement("button"); del.textContent="حذف"; del.onclick=async()=>{
      if(!confirm("حذف؟"))return; await sb.from(ent.table).delete().eq(ent.pk||"id", row[ent.pk||"id"]); renderList(root, ent); };
    td.append(edit, del); tr.appendChild(td); tbl.appendChild(tr);
  });
  root.appendChild(tbl);
}

export async function renderForm(root, ent, row){
  root.innerHTML=`<h2>${ent.label} — ${row[ent.pk||"id"]?"تعديل":"جديد"}</h2>`;
  const form=document.createElement("form"); form.className="admin-form";
  const draft=JSON.parse(JSON.stringify(row||{})); draft.i18n=draft.i18n||{};
  for(const f of ent.fields){
    const label=document.createElement("label"); label.textContent=f.l||f.n;
    let input;
    if(f.t.startsWith("i18n-")){
      const key=f.n.split(".")[1];
      input=localeTabs(f, draft.i18n[key], (loc,val)=>{ draft.i18n[key]=draft.i18n[key]||{}; draft.i18n[key][loc]=val; });
    } else if(f.t==="bool"){ input=document.createElement("input"); input.type="checkbox"; input.checked=!!draft[f.n]; input.onchange=()=>draft[f.n]=input.checked; }
    else if(f.t==="select"){ input=document.createElement("select");
      const opts = Array.isArray(f.options)? f.options.map(v=>({value:v,label:v})) : await taxonomy(f.options.split(":")[1]);
      opts.forEach(o=>{ const op=document.createElement("option"); op.value=o.value; op.textContent=o.label; input.appendChild(op); });
      input.value=draft[f.n]??opts[0]?.value; input.onchange=()=>draft[f.n]=input.value; draft[f.n]=input.value; }
    else if(f.t==="image"){ input=document.createElement("div");
      const img=document.createElement("input"); img.type="file"; img.accept="image/*";
      const cur=document.createElement("input"); cur.value=draft[f.n]||""; cur.placeholder="رابط الصورة"; cur.oninput=()=>draft[f.n]=cur.value;
      img.onchange=async()=>{ const url=await uploadImage(ent.table, img.files[0]); if(url){ cur.value=url; draft[f.n]=url; } };
      input.append(cur, img); }
    else { input=document.createElement("input"); input.type=f.t==="number"?"number":"text"; input.value=draft[f.n]??"";
      input.oninput=()=>draft[f.n]= f.t==="number" ? (input.value===""?null:Number(input.value)) : input.value; }
    label.appendChild(input); form.appendChild(label);
  }
  const save=document.createElement("button"); save.textContent="حفظ"; save.type="submit";
  const back=document.createElement("button"); back.textContent="رجوع"; back.type="button"; back.onclick=()=>renderList(root, ent);
  form.append(save, back);
  form.onsubmit=async(e)=>{ e.preventDefault();
    const pk=ent.pk||"id"; let res;
    if(draft[pk]) res=await sb.from(ent.table).update(draft).eq(pk, draft[pk]);
    else res=await sb.from(ent.table).insert(draft);
    if(res.error) alert(res.error.message); else renderList(root, ent);
  };
  root.appendChild(form);
}

export async function uploadImage(prefix, file){
  if(!file) return null;
  const path=`${prefix}/${Date.now()}-${file.name.replace(/[^\w.\-]/g,"_")}`;
  const { error }=await sb.storage.from("media").upload(path, file, { upsert:true });
  if(error){ alert(error.message); return null; }
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}
