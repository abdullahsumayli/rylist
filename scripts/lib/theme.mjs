// scripts/lib/theme.mjs
// المصدر الوحيد لقيم المظهر. معرّفات هذه الخرائط يجب أن تطابق options في admin/entities.js.
const MONO = "family=IBM+Plex+Mono:wght@400;500";
const G = (families) => `https://fonts.googleapis.com/css2?${families}&${MONO}&display=swap`;

export const FONT_PRESETS = {
  classic: {
    label: "الترف الكلاسيكي",
    href: G("family=Cormorant+Garamond:wght@400;500&family=Hanken+Grotesk:wght@300;400;500;600&family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600"),
    vars: {
      "--font-en-display": '"Cormorant Garamond", Georgia, serif',
      "--font-en-body": '"Hanken Grotesk", system-ui, sans-serif',
      "--font-ar-display": '"Amiri", "Times New Roman", serif',
      "--font-ar-body": '"IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif',
    },
  },
  modern: {
    label: "عصري",
    href: G("family=Hanken+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600"),
    vars: {
      "--font-en-display": '"Hanken Grotesk", system-ui, sans-serif',
      "--font-en-body": '"Hanken Grotesk", system-ui, sans-serif',
      "--font-ar-display": '"IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif',
      "--font-ar-body": '"IBM Plex Sans Arabic", system-ui, Tahoma, sans-serif',
    },
  },
  elegant: {
    label: "أنيق",
    href: G("family=Playfair+Display:wght@400;500;600&family=Tajawal:wght@300;400;500;700"),
    vars: {
      "--font-en-display": '"Playfair Display", Georgia, serif',
      "--font-en-body": '"Tajawal", system-ui, sans-serif',
      "--font-ar-display": '"Tajawal", system-ui, sans-serif',
      "--font-ar-body": '"Tajawal", system-ui, Tahoma, sans-serif',
    },
  },
  simple: {
    label: "بسيط",
    href: G("family=Inter:wght@300;400;500;600&family=Cairo:wght@300;400;600;700"),
    vars: {
      "--font-en-display": '"Inter", system-ui, sans-serif',
      "--font-en-body": '"Inter", system-ui, sans-serif',
      "--font-ar-display": '"Cairo", system-ui, sans-serif',
      "--font-ar-body": '"Cairo", system-ui, Tahoma, sans-serif',
    },
  },
};

export const ACCENT_PRESETS = {
  gold:     { label: "ذهبي",      vars: { "--champagne": "#A38A58", "--gold-deep": "#86713F", "--gold-bright": "#BBA476", "--pale": "#D2C19C" } },
  green:    { label: "أخضر عميق", vars: { "--champagne": "#4E6A4E", "--gold-deep": "#3C523C", "--gold-bright": "#6E8A6E", "--pale": "#AEC2AE" } },
  navy:     { label: "كحلي",      vars: { "--champagne": "#3B4E6B", "--gold-deep": "#2C3B52", "--gold-bright": "#5E739A", "--pale": "#A9B8CE" } },
  charcoal: { label: "فحمي",      vars: { "--champagne": "#55524C", "--gold-deep": "#3A3833", "--gold-bright": "#7A756C", "--pale": "#BFB9AE" } },
  burgundy: { label: "نبيذي",     vars: { "--champagne": "#7A3B4B", "--gold-deep": "#5A2C38", "--gold-bright": "#9A5E6E", "--pale": "#CFA9B4" } },
};

// resolveTheme(row) -> { href, vars } — href = Google Fonts URL, vars = CSS declarations for :root
export function resolveTheme(row = {}) {
  const font = FONT_PRESETS[row?.font_preset] || FONT_PRESETS.classic;
  const accent = ACCENT_PRESETS[row?.accent_preset] || ACCENT_PRESETS.gold;
  const all = { ...font.vars, ...accent.vars };
  const vars = Object.entries(all).map(([k, v]) => `${k}: ${v};`).join(" ");
  return { href: font.href, vars };
}
