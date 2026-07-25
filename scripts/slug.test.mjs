import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSlug } from "../admin/slug.js";

test("makeSlug kebab-cases a latin title", () => {
  assert.equal(makeSlug("Reading Riyadh Prices 2026"), "reading-riyadh-prices-2026");
});

test("makeSlug trims, lowercases and collapses punctuation", () => {
  assert.equal(makeSlug("  Hello,  World!  "), "hello-world");
});

test("makeSlug falls back to a stable id for Arabic-only titles", () => {
  assert.equal(makeSlug("قراءة في الأسعار", 123456789), "p-" + (123456789).toString(36));
});

test("makeSlug falls back for an empty title", () => {
  assert.match(makeSlug("", 1), /^p-/);
});
