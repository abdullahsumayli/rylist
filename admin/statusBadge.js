// Draft/published workflow badge for admin list rows.
// Pure and dependency-free so it can be unit-tested outside the browser.

const BADGES = {
  draft:     { cls: "st-draft", label: "مسودة" },
  published: { cls: "st-live",  label: "منشور" },
};

// Returns {cls, label} for a workflow status, or null when the row has no
// workflow at all (partners, stats, …) — callers render nothing in that case.
export function statusBadge(status) {
  if (typeof status !== "string") return null;
  const b = BADGES[status.trim().toLowerCase()];
  return b ? { ...b } : null;
}
