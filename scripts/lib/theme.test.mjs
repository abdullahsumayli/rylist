import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme, FONT_PRESETS, ACCENT_PRESETS } from "./theme.mjs";

test("resolveTheme returns classic/gold defaults when row is empty", () => {
  const t = resolveTheme({});
  assert.match(t.href, /Cormorant\+Garamond/);
  assert.match(t.vars, /--champagne:\s*#A38A58/);
  assert.match(t.vars, /--font-ar-body:/);
});

test("resolveTheme applies a chosen font + accent preset", () => {
  const t = resolveTheme({ font_preset: "elegant", accent_preset: "green" });
  assert.match(t.href, /Playfair\+Display/);
  assert.match(t.href, /Tajawal/);
  assert.match(t.vars, /--champagne:\s*#4E6A4E/);
});

test("resolveTheme falls back to defaults for unknown ids", () => {
  const t = resolveTheme({ font_preset: "nope", accent_preset: "nope" });
  assert.match(t.href, /Cormorant\+Garamond/);
  assert.match(t.vars, /--champagne:\s*#A38A58/);
});

test("every preset id is present in the exported maps", () => {
  assert.deepEqual(Object.keys(FONT_PRESETS), ["classic", "modern", "elegant", "simple"]);
  assert.deepEqual(Object.keys(ACCENT_PRESETS), ["gold", "green", "navy", "charcoal", "burgundy"]);
});

test("classic default --font-en-body mirrors the live CSS fallback chain exactly", () => {
  const t = resolveTheme({});
  assert.ok(
    t.vars.includes('--font-en-body: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif;'),
  );
});

test("resolveTheme(null) and resolveTheme(undefined) return classic/gold", () => {
  assert.match(resolveTheme(null).href, /Cormorant\+Garamond/);
  assert.match(resolveTheme(undefined).href, /Cormorant\+Garamond/);
});

test("mixed row (font only) keeps the gold accent default", () => {
  const t = resolveTheme({ font_preset: "modern" });
  assert.match(t.vars, /--champagne:\s*#A38A58/);
  assert.match(t.href, /Hanken\+Grotesk/);
});

test("resolveTheme falls back to defaults for a __proto__ id", () => {
  const t = resolveTheme({ font_preset: "__proto__", accent_preset: "__proto__" });
  assert.match(t.href, /Cormorant\+Garamond/);
  assert.match(t.vars, /--champagne:\s*#A38A58/);
});
