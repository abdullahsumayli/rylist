import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectUrls, hrefFor, localNameFor, mirrorMedia, resolveExisting, rewriteTree } from "./mirrorMedia.mjs";

const REMOTE = "https://ghtcwsbtyvczlznviojj.supabase.co/storage/v1/object/public/media/news/a.jpg";

test("localNameFor drops the bucket and keeps the path", () => {
  assert.equal(localNameFor(REMOTE), "news/a.jpg");
  assert.equal(localNameFor(REMOTE + "?v=2"), "news/a.jpg");
  assert.equal(hrefFor("news/a.jpg"), "/assets/img/news/a.jpg");
});

test("localNameFor ignores anything that is not storage", () => {
  assert.equal(localNameFor("assets/img/hero-najdi.webp"), null);
  assert.equal(localNameFor("https://rega.gov.sa/x.png"), null);
  assert.equal(localNameFor(""), null);
  assert.equal(localNameFor(null), null);
});

test("localNameFor refuses a path that escapes the folder", () => {
  const evil = "https://x.supabase.co/storage/v1/object/public/media/../../etc/passwd";
  assert.equal(localNameFor(evil), null);
});

test("collectUrls finds every storage url once, at any depth", () => {
  const c = { news: [{ image_url: REMOTE }, { image_url: REMOTE }], home: { hero: { img: "assets/img/x.webp" } } };
  assert.deepEqual([...collectUrls(c)], [REMOTE]);
});

test("rewriteTree swaps mapped strings and leaves the rest alone", () => {
  const map = new Map([[REMOTE, "/assets/img/news/a.jpg"]]);
  const out = rewriteTree({ news: [{ image_url: REMOTE, title: "خبر" }], n: 3, ok: true, none: null }, map);
  assert.deepEqual(out, { news: [{ image_url: "/assets/img/news/a.jpg", title: "خبر" }], n: 3, ok: true, none: null });
});

test("mirrorMedia downloads what is missing and rewrites to the local path", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
  let calls = 0;
  const out = await mirrorMedia({ news: [{ image_url: REMOTE }] }, {
    root,
    log: () => {},
    fetch: async () => { calls++; return { ok: true, arrayBuffer: async () => new TextEncoder().encode("PNG").buffer }; },
  });
  assert.equal(calls, 1);
  assert.equal(out.news[0].image_url, "/assets/img/news/a.jpg");
  assert.equal(fs.readFileSync(path.join(root, "assets/img/news/a.jpg"), "utf8"), "PNG");
});

test("mirrorMedia does not re-download a file already in the repo", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
  fs.mkdirSync(path.join(root, "assets/img/news"), { recursive: true });
  fs.writeFileSync(path.join(root, "assets/img/news/a.jpg"), "CACHED");
  let calls = 0;
  const out = await mirrorMedia({ news: [{ image_url: REMOTE }] }, {
    root, log: () => {}, fetch: async () => { calls++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; },
  });
  assert.equal(calls, 0, "البناء المعتاد لا يلمس الشبكة");
  assert.equal(out.news[0].image_url, "/assets/img/news/a.jpg");
  assert.equal(fs.readFileSync(path.join(root, "assets/img/news/a.jpg"), "utf8"), "CACHED");
});

test("a failed download keeps the remote url and does not throw", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
  const out = await mirrorMedia({ news: [{ image_url: REMOTE }] }, {
    root, log: () => {}, fetch: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(out.news[0].image_url, REMOTE, "صورةٌ متعذّرة أهون من نشرةٍ لا تخرج");
  assert.equal(fs.existsSync(path.join(root, "assets/img/news/a.jpg")), false);
});

const PNG_URL = "https://ghtcwsbtyvczlznviojj.supabase.co/storage/v1/object/public/media/news/heavy.png";

test("an optimised twin next to the original wins — and nothing is downloaded", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
  fs.mkdirSync(path.join(root, "assets/img/news"), { recursive: true });
  fs.writeFileSync(path.join(root, "assets/img/news/heavy.jpg"), "SMALL");
  let calls = 0;
  const out = await mirrorMedia({ news: [{ image_url: PNG_URL }] }, {
    root, log: () => {}, fetch: async () => { calls++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; },
  });
  assert.equal(calls, 0);
  assert.equal(out.news[0].image_url, "/assets/img/news/heavy.jpg", "اسمُ الأصل في القاعدة لا يتغيّر، والصفحة تشير إلى الأخفّ");
});

test("resolveExisting prefers webp, then jpg, then the original name", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
  fs.mkdirSync(path.join(root, "assets/img/news"), { recursive: true });
  fs.writeFileSync(path.join(root, "assets/img/news/x.png"), "P");
  assert.equal(resolveExisting(root, "news/x.png"), "news/x.png");
  fs.writeFileSync(path.join(root, "assets/img/news/x.jpg"), "J");
  assert.equal(resolveExisting(root, "news/x.png"), "news/x.jpg");
  fs.writeFileSync(path.join(root, "assets/img/news/x.webp"), "W");
  assert.equal(resolveExisting(root, "news/x.png"), "news/x.webp");
  assert.equal(resolveExisting(root, "news/missing.png"), null);
});
