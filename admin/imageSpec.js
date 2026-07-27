// تحقّق نقيّ من مواصفات صورة قبل رفعها — بلا DOM ولا Supabase حتى يبقى قابلًا للاختبار.
// المواصفات تُعلَن في entities.js عبر `spec:{...}` على الحقل:
//   maxKB · أقصى حجم ملف
//   maxW/maxH · أقصى أبعاد (للشعارات؛ لا تُستعمل مع صور الهيرو)
//   minW · أقل عرض مقبول (يمنع مدّ صورة صغيرة على خلفية عريضة)
//   recW/recH · الأبعاد المقترحة، للرسالة فقط
export function fmtBytes(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";
}

// يرجع null إن كان الملف مطابقًا، وإلا { has, need } نصّين جاهزين للعرض.
export function checkImageSpec(spec, sizeBytes, dims) {
  if (!spec) return null;
  const w = (dims && dims.w) || 0;
  const h = (dims && dims.h) || 0;
  const overSize = spec.maxKB && sizeBytes > spec.maxKB * 1024;
  // فحوص الأبعاد تُتخطّى إن تعذّر قياسها (SVG مثلًا) — w = 0
  const overDim = spec.maxW && w && (w > spec.maxW || (spec.maxH && h > spec.maxH));
  const underDim = spec.minW && w && w < spec.minW;
  if (!overSize && !overDim && !underDim) return null;

  const has = ["حجمه " + fmtBytes(sizeBytes)];
  if (w) has.push("أبعاده " + w + "×" + h + "px");
  const need = [];
  if (spec.maxKB) need.push("≤ " + spec.maxKB + "KB");
  if (spec.minW) need.push("عرض ≥ " + spec.minW + "px");
  if (spec.recW) need.push("~" + spec.recW + "×" + spec.recH + "px");
  return { has: has.join(" و"), need: need.join(" و") };
}
