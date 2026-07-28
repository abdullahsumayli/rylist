import { test } from "node:test";
import assert from "node:assert/strict";
import { statusBadge } from "./statusBadge.js";

test("draft rows get the red draft badge", () => {
  assert.deepEqual(statusBadge("draft"), { cls: "st-draft", label: "مسودة" });
});

test("published rows get the blue published badge", () => {
  assert.deepEqual(statusBadge("published"), { cls: "st-live", label: "منشور" });
});

// Entities without a draft/published workflow (partners, stats, …) must render
// no badge at all rather than an empty or mislabelled one.
test("missing or unknown status yields no badge", () => {
  assert.equal(statusBadge(undefined), null);
  assert.equal(statusBadge(null), null);
  assert.equal(statusBadge(""), null);
  assert.equal(statusBadge("archived"), null);
});

test("tolerates padding and casing from the database", () => {
  assert.deepEqual(statusBadge(" Draft "), { cls: "st-draft", label: "مسودة" });
  assert.deepEqual(statusBadge("PUBLISHED"), { cls: "st-live", label: "منشور" });
});

test("does not treat a non-string as a status", () => {
  assert.equal(statusBadge(0), null);
  assert.equal(statusBadge({ status: "draft" }), null);
});
