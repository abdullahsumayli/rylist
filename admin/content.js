import { sb } from "./db.js";
import { uploadImage, localeTabs } from "./fields.js";
import { blankI18n, blankPair, blankUnit, blankUnitType, buildPayload } from "./content-data.js";

const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

// reorder (▲▼) + delete (🗑) tool cluster shared by every list editor.
function rowTools(arr, i, render, confirmMsg) {
  const tools = el("div", "ci-tools");
  const up = el("button", "btn ci-mini", "▲"); up.type = "button"; up.disabled = i === 0;
  up.onclick = () => { move(arr, i, -1); render(); };
  const down = el("button", "btn ci-mini", "▼"); down.type = "button"; down.disabled = i === arr.length - 1;
  down.onclick = () => { move(arr, i, 1); render(); };
  const del = el("button", "btn ci-mini", "🗑"); del.type = "button";
  del.onclick = () => { if (!confirm(confirmMsg || "حذف؟")) return; arr.splice(i, 1); render(); };
  tools.append(up, down, del);
  return tools;
}

// i18nField(value, rich?) -> element. `value` is an i18n object mutated in place.
function i18nField(value, rich = false) {
  const tabs = localeTabs({ t: rich ? "i18n-rich" : "i18n-text" }, value, (loc, val) => { value[loc] = val; });
  return tabs.el;
}

// imageInput(getVal, setVal, prefix) -> element for a single image (thumb + url + upload).
function imageInput(getVal, setVal, prefix) {
  const box = el("div", "ci-imageinput");
  const row = el("div", "ci-gallery-row");
  const thumb = document.createElement("img"); thumb.className = "ci-thumb"; thumb.alt = ""; thumb.src = getVal() || "";
  const input = document.createElement("input"); input.value = getVal() || ""; input.placeholder = "رابط الصورة";
  input.oninput = () => { setVal(input.value); thumb.src = input.value; };
  row.append(thumb, input);
  const up = document.createElement("input"); up.type = "file"; up.accept = "image/*";
  const status = el("p", "uploadstatus"); status.hidden = true;
  up.onchange = async () => {
    const file = up.files[0]; if (!file) return;
    up.disabled = true; status.hidden = false; status.className = "uploadstatus is-busy"; status.textContent = "⏳ جارٍ الرفع…";
    const url = await uploadImage(prefix, file);
    up.disabled = false; up.value = "";
    if (url) { input.value = url; setVal(url); thumb.src = url; status.className = "uploadstatus is-ok"; status.textContent = "✓ تم الرفع"; }
    else { status.className = "uploadstatus is-err"; status.textContent = "✗ تعذّر الرفع"; }
  };
  box.append(row, up, status);
  return box;
}

// galleryEditor(arr, prefix) -> element. arr is an array of URL strings, mutated in place.
function galleryEditor(arr, prefix) {
  const wrap = el("div", "ci-list");
  const listEl = el("div");
  const render = () => {
    listEl.innerHTML = "";
    arr.forEach((url, i) => {
      const row = el("div", "ci-gallery-row");
      const thumb = document.createElement("img"); thumb.className = "ci-thumb"; thumb.alt = ""; thumb.src = url || "";
      const input = document.createElement("input"); input.value = url || ""; input.placeholder = "رابط الصورة";
      input.oninput = () => { arr[i] = input.value; thumb.src = input.value; };
      row.append(thumb, input, rowTools(arr, i, render, "حذف الصورة؟"));
      listEl.appendChild(row);
    });
  };
  const actions = el("div", "ci-actions");
  const up = document.createElement("input"); up.type = "file"; up.accept = "image/*";
  const status = el("p", "uploadstatus"); status.hidden = true;
  up.onchange = async () => {
    const file = up.files[0]; if (!file) return;
    up.disabled = true; status.hidden = false; status.className = "uploadstatus is-busy"; status.textContent = "⏳ جارٍ الرفع…";
    const url = await uploadImage(prefix, file);
    up.disabled = false; up.value = "";
    if (url) { arr.push(url); render(); status.className = "uploadstatus is-ok"; status.textContent = "✓ تم الرفع"; }
    else { status.className = "uploadstatus is-err"; status.textContent = "✗ تعذّر الرفع"; }
  };
  const addUrl = el("button", "btn", "+ رابط"); addUrl.type = "button";
  addUrl.onclick = () => { arr.push(""); render(); };
  actions.append(up, addUrl, status);
  wrap.append(listEl, actions); render();
  return wrap;
}

// pairsEditor(arr, aKey, bKey, aLabel, bLabel, mkBlank) -> element.
// arr is an array of { [aKey]:i18n, [bKey]:i18n } mutated in place.
function pairsEditor(arr, aKey, bKey, aLabel, bLabel, mkBlank) {
  const wrap = el("div", "ci-list");
  const listEl = el("div");
  const render = () => {
    listEl.innerHTML = "";
    arr.forEach((pair, i) => {
      pair[aKey] = pair[aKey] || blankI18n();
      pair[bKey] = pair[bKey] || blankI18n();
      const row = el("div", "ci-pair-row");
      const a = el("div", "ci-col"); a.append(el("label", "ci-lbl", aLabel), i18nField(pair[aKey]));
      const b = el("div", "ci-col"); b.append(el("label", "ci-lbl", bLabel), i18nField(pair[bKey]));
      row.append(a, b, rowTools(arr, i, render, "حذف الصف؟"));
      listEl.appendChild(row);
    });
  };
  const add = el("button", "btn", "+ صف"); add.type = "button";
  add.onclick = () => { arr.push(mkBlank()); render(); };
  wrap.append(listEl, add); render();
  return wrap;
}

// stringsEditor(arr) -> element. arr is an array of i18n objects mutated in place.
function stringsEditor(arr) {
  const wrap = el("div", "ci-list");
  const listEl = el("div");
  const render = () => {
    listEl.innerHTML = "";
    arr.forEach((val, i) => {
      if (!val || typeof val !== "object") arr[i] = blankI18n();
      const row = el("div", "ci-string-row");
      const c = el("div", "ci-col"); c.append(i18nField(arr[i]));
      row.append(c, rowTools(arr, i, render, "حذف السطر؟"));
      listEl.appendChild(row);
    });
  };
  const add = el("button", "btn", "+ سطر"); add.type = "button";
  add.onclick = () => { arr.push(blankI18n()); render(); };
  wrap.append(listEl, add); render();
  return wrap;
}

// collapsible(icon, title, countFn, bodyFn) -> element with a lazily-built body.
// The returned element carries `_refreshCount()` to update its counter.
function collapsible(icon, title, countFn, bodyFn) {
  const sec = el("div", "ci-sec");
  const head = el("button", "ci-sec-head"); head.type = "button";
  const caret = el("span", "ci-caret", "▸");
  const label = el("span", "ci-sec-title", `${icon} ${title}`);
  const count = el("span", "ci-sec-count");
  const setCount = () => { count.textContent = `(${countFn()})`; };
  head.append(caret, label, count);
  const body = el("div", "ci-sec-body"); body.hidden = true;
  let built = false;
  head.onclick = () => {
    body.hidden = !body.hidden;
    caret.textContent = body.hidden ? "▸" : "▾";
    if (!built && !body.hidden) { body.appendChild(bodyFn()); built = true; }
    setCount();
  };
  setCount();
  sec.append(head, body);
  sec._refreshCount = setCount;
  return sec;
}
