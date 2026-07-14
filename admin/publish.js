import { sb } from "./db.js";

// المدّة التقديرية لبناء الموقع على Vercel (لعرض شريط التقدّم والعدّاد).
const EST_SECONDS = 80;

export function renderPublish(root){
  root.innerHTML = `<div class="pagehead"><div class="ttl"><h1>نشر الموقع</h1></div></div>`;

  // الإطار التوضيحي مع الخطوات
  const box = document.createElement("div");
  box.className = "pub-callout";
  box.innerHTML = `
    <div class="pub-head">💛 <span>يا حبيب قلبي، انشر موقعك</span></div>
    <p class="pub-lead">أي تعديل تسوّيه <b>ما يظهر على الموقع مباشرة</b>. عشان يشوفه الناس، سوِّ هالثلاث خطوات البسيطة:</p>
    <ol class="pub-steps">
      <li>عدِّل اللي تبي في أي صفحة.</li>
      <li>اضغط زر <b>«حفظ»</b> تحت في كل صفحة عدّلتها.</li>
      <li>ارجع هنا واضغط الزر الأحمر الكبير 👇</li>
    </ol>
  `;

  // الزر الكبير
  const btn = document.createElement("button");
  btn.className = "pub-btn-big";
  btn.type = "button";
  const MAIN_LABEL = "اضغط هنا وانشر موقعك";
  const label = (t) => { btn.innerHTML = `<span class="pub-btn-ic" aria-hidden="true">📢</span><span>${t}</span>`; };
  label(MAIN_LABEL);

  const hint = document.createElement("p");
  hint.className = "pub-hint";
  hint.textContent = "بعد الضغط، انتظر دقيقة بالكثير وبتلاقي كل شي ظهر على الموقع.";

  // لوحة التقدّم (تظهر بعد الضغط)
  const panel = document.createElement("div");
  panel.className = "pub-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="pub-row"><span class="pub-spin" aria-hidden="true"></span><span class="pub-msg"></span></div>
    <div class="pub-bar"><span class="pub-bar-fill"></span></div>
  `;
  const msg  = panel.querySelector(".pub-msg");
  const fill = panel.querySelector(".pub-bar-fill");

  let timer = null;
  const stopTimer = () => { if(timer){ clearInterval(timer); timer = null; } };
  const setState  = (s) => panel.setAttribute("data-state", s);

  const showError = (text) => {
    stopTimer(); setState("err");
    fill.style.width = "0%";
    msg.textContent = "⚠ " + text;
    btn.disabled = false; label("حاول مرة ثانية");
  };

  const done = () => {
    stopTimer(); setState("ok");
    fill.style.width = "100%";
    msg.textContent = "✅ تم نشر الموقع بنجاح! لمشاهدة التغييرات افتح الموقع وحدّث الصفحة.";
    const open = document.createElement("a");
    open.className = "pub-open";
    open.textContent = "افتح الموقع ↗";
    open.href = "https://rylist.sa/?t=" + Date.now(); // كسر ذاكرة المتصفّح ليظهر أحدث بناء
    open.target = "_blank"; open.rel = "noopener";
    msg.append(document.createElement("br"), open);
    btn.disabled = false; label("نشر مرة أخرى");
  };

  // شريط تقدّم تقديري يتحرّك خلال مدّة البناء ثم يكتمل
  const runProgress = () => {
    setState("busy");
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      fill.style.width = Math.min(97, (elapsed / EST_SECONDS) * 100).toFixed(1) + "%";
      const left = Math.max(0, Math.ceil(EST_SECONDS - elapsed));
      msg.textContent = `جارٍ نشر الموقع… يكتمل خلال ~${left} ثانية`;
      if(elapsed >= EST_SECONDS) done();
    };
    tick();
    timer = setInterval(tick, 1000);
  };

  btn.onclick = async () => {
    stopTimer();
    btn.disabled = true; label(MAIN_LABEL);
    panel.hidden = false; setState("busy");
    fill.style.width = "0%";
    msg.textContent = "جارٍ إطلاق النشر…";
    try {
      const { data: { session } } = await sb.auth.getSession();
      if(!session){ showError("انتهت جلسة الدخول. سجّل الدخول من جديد ثم أعد المحاولة."); return; }
      const res = await sb.functions.invoke("publish", { headers:{ Authorization:`Bearer ${session.access_token}` } });
      if(res.error){ showError("تعذّر إطلاق النشر: " + res.error.message); return; }
      runProgress();
    } catch (e) {
      showError("حدث خطأ غير متوقّع: " + (e?.message || e));
    }
  };

  box.append(btn, hint, panel);
  root.append(box);
}
