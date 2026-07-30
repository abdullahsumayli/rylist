// اكتمال لغات المقال. القاعدة: ما يُنشر مقال إلا وفيه عنوان ونص بكل لغة مفعّلة.
// النص محرَّر غنيّ، فالفراغ الحقيقي يُقاس بعد نزع الوسوم — <p><br></p> فاضية لا مكتوبة.

export function textOf(html) {
  return String(html == null ? "" : html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// keys = [{ key, label }] — حقول i18n المطلوبة. codes = ["ar","en","zh"].
// يرجّع { [code]: [أسماء الحقول الناقصة] } — واللغات المكتملة لا تظهر أصلًا.
export function localeGaps(i18n, keys, codes) {
  const out = {};
  for (const code of codes) {
    const missing = keys.filter((k) => !textOf((i18n && i18n[k.key] || {})[code]));
    if (missing.length) out[code] = missing.map((k) => k.label);
  }
  return out;
}

export function isComplete(i18n, keys, codes) {
  return Object.keys(localeGaps(i18n, keys, codes)).length === 0;
}

// "الإنجليزي (النص)، الصيني (العنوان والمقال)"
export function gapsSentence(gaps, names) {
  return Object.keys(gaps)
    .map((code) => `${(names && names[code]) || code} (${gaps[code].join(" و")})`)
    .join("، ");
}
