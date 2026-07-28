// scripts/lib/footerPartial.mjs
// يقتطع فوتر الموقع من index.html وقت البناء ويجهّزه للحقن في صفحات المشاريع
// والمقالات — وهي مبنيّة من قوالب لم يكن فيها فوتر إطلاقًا.
//
// لماذا يُقتطع بدل أن يُكتب هنا نسخةً ثانية: فوتر الموقع مكرّر أصلًا في إحدى
// عشرة صفحة ثابتة. نسخة ثانية عشرة داخل جافاسكربت ستتفرّع عن الأصل خلال أسابيع،
// وفوتر التراخيص تحديدًا ما يصحّ فيه تفرّع. index.html هو المصدر، وأي تعديل عليه
// ينتشر تلقائيًا لصفحات المشاريع.

import fs from "node:fs";
import { parse } from "node-html-parser";
import { applyContent } from "./applyContent.mjs";
import { localizeNode, fillContact, revealFilled } from "./localize.mjs";

const SOURCE = "index.html";

// المسارات في index.html نسبية لأنه في جذر الموقع. صفحة المشروع تسكن
// /projects/ أو /<lang>/projects/، فالنسبي ينكسر. نُحوّلها جذرية: لا تعتمد
// على العمق إطلاقًا، فلا يكسرها أي تعشيش لاحق.
function absolutizeLinks(root, localeRoot) {
  root.querySelectorAll("[href],[src]").forEach((el) => {
    for (const attr of ["href", "src"]) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      if (/^(https?:|mailto:|tel:|#|\/|data:)/.test(v)) continue;  // خارجية أو جذرية أصلًا
      if (/^(assets\/|favicon\.svg)/.test(v)) { el.setAttribute(attr, "/" + v); continue; }
      // index.html → جذر اللغة نفسه، وبقيّة الصفحات تحته
      el.setAttribute(attr, v === "index.html" ? localeRoot : localeRoot + v);
    }
  });
}

// buildFooter({ locale, contact, content, year }) -> HTML string
// content = نفس شكل ما تمرّره renderPages: { text: {...}, heroImage }
export function buildFooter({ locale, contact, content, year, source } = {}) {
  const html = fs.readFileSync(source || SOURCE, "utf8");
  const footer = parse(html, { comment: true }).querySelector("footer.site-footer");
  if (!footer) throw new Error("footerPartial: لم يُعثر على footer.site-footer في " + (source || SOURCE));

  localizeNode(footer, locale);
  applyContent(footer, content || {}, locale);   // بعد تبديل اللغة ليتغلّب محتوى القاعدة
  fillContact(footer, contact, locale, year);
  revealFilled(footer, content || {}, locale);   // بيانات المنشأة تظهر أول ما تُعبّأ
  absolutizeLinks(footer, locale === "ar" ? "/" : `/${locale}/`);

  return footer.toString();
}
