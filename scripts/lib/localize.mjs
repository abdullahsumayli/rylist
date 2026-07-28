// scripts/lib/localize.mjs
// عمليات «تثبيت» شجرة HTML على لغة واحدة وقت البناء: تبديل نصوص data-<locale>،
// وملء بيانات التواصل. كانت الأولى مكتوبة داخل renderPages وحدها، فبقيت صفحات
// المشاريع والمقالات — المبنيّة من قوالب — خارجها.
//
// ملء التواصل هنا مقصود أن يكون وقت البناء لا وقت التشغيل: main.js يستبدل الرقم
// النائب بعد تحميل جافاسكربت، فيبقى في مصدر الصفحة رقمٌ غير حقيقي يقرؤه الزاحف
// وقارئ المصدر. وصفحات المشاريع لا تحمّل main.js أصلًا.

// نص رسالة واتساب الافتتاحية — مطابق لما في assets/js/main.js
const WA_MSG = {
  ar: "مرحبًا RYLIST، لديّ استفسار.",
  en: "Hello RYLIST, I have an inquiry.",
  zh: "你好 RYLIST，我有一个咨询。",
};

// يبدّل نصوص العناصر المعلَّمة بـ data-<locale> (والـ placeholder و aria-label).
// العربية هي النص المكتوب في HTML فلا تحتاج تبديلًا.
export function localizeNode(root, locale) {
  if (locale === "ar") return root;
  root.querySelectorAll(`[data-${locale}]`).forEach((el) => {
    const tag = (el.rawTagName || "").toLowerCase();
    // <meta> يحمل نصّه في خاصية content لا في أبنائه
    if (tag === "meta") el.setAttribute("content", el.getAttribute(`data-${locale}`));
    else el.set_content(el.getAttribute(`data-${locale}`));
  });
  root.querySelectorAll(`[data-${locale}-ph]`).forEach((el) => el.setAttribute("placeholder", el.getAttribute(`data-${locale}-ph`)));
  // aria-label ليس زينة: زر فاهم يُخفى نصّه الظاهر على الجوال فيبقى aria-label اسمَه الوحيد
  root.querySelectorAll(`[data-${locale}-aria]`).forEach((el) => el.setAttribute("aria-label", el.getAttribute(`data-${locale}-aria`)));
  return root;
}

export function fillContact(root, contact, locale, year) {
  const c = contact || {};
  if (c.whatsapp) {
    const msg = encodeURIComponent(WA_MSG[locale] || WA_MSG.ar);
    root.querySelectorAll("[data-wa]").forEach((el) => el.setAttribute("href", `https://wa.me/${c.whatsapp}?text=${msg}`));
  }
  if (c.email) {
    root.querySelectorAll("[data-email]").forEach((el) => {
      el.setAttribute("href", "mailto:" + c.email);
      if (el.hasAttribute("data-email-text")) el.set_content(c.email);
    });
  }
  if (c.phone) {
    root.querySelectorAll("[data-phone]").forEach((el) => {
      el.setAttribute("href", "tel:" + String(c.phone).replace(/\s/g, ""));
      if (el.hasAttribute("data-phone-text")) el.set_content(c.phone);
    });
  }
  root.querySelectorAll("[data-year]").forEach((el) => el.set_content(String(year ?? new Date().getFullYear())));
  return root;
}

// كتلة مبنيّة ومخفيّة تظهر أول ما يُعبّأ أحد مفاتيحها من لوحة التحكم:
//   <p hidden data-reveal-if="cr_number,vat_number">…</p>
// بدونها تحتاج بياناتُ المنشأة تعديلَ كود لإظهارها — وهي بيانات تُعبّأ لا تُبرمَج.
export function revealFilled(root, content, locale) {
  const text = (content && content.text) || {};
  root.querySelectorAll("[data-reveal-if]").forEach((el) => {
    const keys = el.getAttribute("data-reveal-if").split(",").map((k) => k.trim()).filter(Boolean);
    const any = keys.some((k) => String(text[k]?.[locale] ?? "").trim() !== "");
    if (any) el.removeAttribute("hidden");
  });
  return root;
}
