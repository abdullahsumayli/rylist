// scripts/lib/renderCompliance.mjs
// «صندوق الترخيص» — البيانات الإلزامية للإعلان العقاري أسفل صفحة كل مشروع.
// وحدة نقية: تستقبل صف المشروع واللغة وتُرجع HTML. لا نظام ملفات ولا Supabase.
//
// القاعدة الحاكمة: كل سطر قيمته فارغة يُقصى كليًا. لا «—» ولا «قيد الإصدار» —
// طباعة بديل مكان رقم ترخيص الإعلان تُقرأ إقرارًا مكتوبًا بغيابه، والفراغ أسلم.

import { FAL, ENTITY, DISCLAIMER } from "./compliance.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// اللغة المطلوبة ثم العربية — لغة غير معروفة تسقط للعربية بدل أن تُنتج فراغًا
const pick = (o, loc) => (o && (o[loc] || o.ar)) || "";
const filled = (v) => typeof v === "string" && v.trim() !== "";

const L = {
  head:      { ar: "بيانات الإعلان والتراخيص", en: "Advertisement & licensing details", zh: "广告与牌照信息" },
  adLicense: { ar: "رقم ترخيص الإعلان", en: "Advertising licence no.", zh: "广告许可编号" },
  fal:       { ar: "رخصة فال", en: "FAL licence", zh: "FAL 牌照" },
  advertiser:{ ar: "المعلن وصفته", en: "Advertiser & capacity", zh: "广告主及其身份" },
  developer: { ar: "المطوّر", en: "Developer", zh: "开发商" },
  devLicense:{ ar: "رقم ترخيص المطوّر", en: "Developer licence no.", zh: "开发商牌照编号" },
  plan:      { ar: "رقم المخطط", en: "Plan no.", zh: "规划编号" },
  wafi:      { ar: "رقم تسجيل المشروع", en: "Project registration no.", zh: "项目注册编号" },
  propStatus:{ ar: "حالة العقار", en: "Property status", zh: "房产状态" },
  verify:    { ar: "تحقّق من الرخصة ↗", en: "Verify the licence ↗", zh: "核验牌照 ↗" },
};

const PROPERTY_STATUS = {
  clear:     { ar: "خالٍ من الرهن والنزاع", en: "Free of mortgage and dispute", zh: "无抵押、无纠纷" },
  mortgaged: { ar: "عليه رهن", en: "Subject to a mortgage", zh: "设有抵押" },
  disputed:  { ar: "عليه نزاع", en: "Subject to a dispute", zh: "存在纠纷" },
};

const SALE_TYPE = {
  ready:   { ar: "جاهز", en: "Ready", zh: "现房" },
  offplan: { ar: "على الخارطة", en: "Off-plan", zh: "期房" },
};

// شارة تصنيف البيع بجانب حالة التوفّر. البيع على الخارطة إطار تنظيمي مستقل،
// وإخفاء التصنيف يترك المشروع في منطقة رمادية — لكن تصنيفًا مخترَعًا أسوأ،
// فالقيمة غير المعروفة لا تُطبع شيئًا.
export function saleTypeBadge(p, loc) {
  const t = SALE_TYPE[p?.sale_type];
  if (!t) return "";
  return `<span class="sale-pill sale-pill--${esc(p.sale_type)}">${esc(pick(t, loc))}</span>`;
}

export function complianceHtml(p, loc) {
  const row = (labelMap, value) =>
    filled(value)
      ? `<div class="pcomp__row"><span class="pcomp__k">${esc(pick(labelMap, loc))}</span><span class="pcomp__v">${esc(value)}</span></div>`
      : "";

  const dev = pick(p?.i18n?.developer, loc);
  const status = PROPERTY_STATUS[p?.property_status];

  const rows = [
    row(L.adLicense, p?.ad_license),
    // فال ثابتة: هي رخصة المنصة نفسها لا رخصة المشروع، فتظهر دائمًا
    `<div class="pcomp__row"><span class="pcomp__k">${esc(pick(L.fal, loc))}</span>`
      + `<span class="pcomp__v"><a href="${FAL.verifyUrl}" target="_blank" rel="noopener">`
      + `<span dir="ltr">${esc(FAL.number)}</span> <span class="pcomp__verify">${esc(pick(L.verify, loc))}</span></a></span></div>`,
    `<div class="pcomp__row"><span class="pcomp__k">${esc(pick(L.advertiser, loc))}</span>`
      + `<span class="pcomp__v">${esc(pick(ENTITY.name, loc))} · ${esc(pick(ENTITY.capacity, loc))}</span></div>`,
    row(L.developer, dev),
    row(L.devLicense, p?.developer_license),
    row(L.plan, p?.plan_number),
    row(L.wafi, p?.wafi_number),
    status ? row(L.propStatus, pick(status, loc)) : "",
  ].filter(Boolean).join("");

  return `<section class="psec pcompliance">`
    + `<h2>${esc(pick(L.head, loc))}</h2>`
    + `<div class="pcomp__grid">${rows}</div>`
    + `<p class="pcomp__note">${esc(pick(DISCLAIMER, loc))}</p>`
    + `</section>`;
}
