import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtml } from "./sanitizeHtml.mjs";

test("keeps allowlisted tags and text", () => {
  assert.equal(sanitizeHtml("<p>hi <strong>there</strong></p>"), "<p>hi <strong>there</strong></p>");
});

test("drops script and style entirely, including their text", () => {
  assert.equal(sanitizeHtml('<p>ok</p><script>alert(1)</script>'), "<p>ok</p>");
  assert.equal(sanitizeHtml('<style>body{}</style><p>ok</p>'), "<p>ok</p>");
});

test("unwraps non-allowlisted tags but keeps their text", () => {
  assert.equal(sanitizeHtml("<div><span>keep</span></div>"), "keep");
  assert.equal(sanitizeHtml('<iframe src="evil"></iframe><p>ok</p>'), "<p>ok</p>");
});

test("strips event handlers and javascript: urls", () => {
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)" onclick="x()">t</a>'),
    '<a target="_blank" rel="noopener nofollow">t</a>');
});

test("keeps safe href and adds target/rel to links", () => {
  assert.equal(sanitizeHtml('<a href="https://a.com">go</a>'),
    '<a href="https://a.com" target="_blank" rel="noopener nofollow">go</a>');
});

// Internal links carry SEO weight, so they must keep their href and must NOT be
// nofollowed or forced into a new tab — unlike outbound links.
test("keeps root-relative internal links followable and in the same tab", () => {
  assert.equal(sanitizeHtml('<a href="/projects.html">المشاريع</a>'),
    '<a href="/projects.html">المشاريع</a>');
  assert.equal(sanitizeHtml('<a href="/news/off-plan-buying-guide-saudi.html">دليل</a>'),
    '<a href="/news/off-plan-buying-guide-saudi.html">دليل</a>');
});

test("treats protocol-relative urls as external, not internal", () => {
  assert.equal(sanitizeHtml('<a href="//evil.com">x</a>'),
    '<a target="_blank" rel="noopener nofollow">x</a>');
});

test("keeps img with http/https/data-image src, drops other src", () => {
  assert.equal(sanitizeHtml('<img src="https://x/i.png" alt="a">'), '<img src="https://x/i.png" alt="a">');
  assert.equal(sanitizeHtml('<img src="javascript:x" alt="a">'), '<img alt="a">');
});

test("keeps tables with colspan/rowspan, drops other attrs", () => {
  assert.equal(
    sanitizeHtml('<table><tbody><tr><td colspan="2" bgcolor="red">c</td></tr></tbody></table>'),
    '<table><tbody><tr><td colspan="2">c</td></tr></tbody></table>');
});

test("keeps only adetail__ class names", () => {
  assert.equal(sanitizeHtml('<img class="adetail__img evil" src="https://x/i.png" alt="">'),
    '<img class="adetail__img" src="https://x/i.png" alt="">');
  assert.equal(sanitizeHtml('<p class="evil">x</p>'), "<p>x</p>");
});

test("escapes stray angle brackets and ampersands in text", () => {
  assert.equal(sanitizeHtml("a < b & c"), "a &lt; b &amp; c");
});

test("does not double-encode existing entities (editor stores innerHTML)", () => {
  assert.equal(sanitizeHtml("<p>Q&amp;A &lt;x&gt;</p>"), "<p>Q&amp;A &lt;x&gt;</p>");
});

test("empty / nullish input returns empty string", () => {
  assert.equal(sanitizeHtml(""), "");
  assert.equal(sanitizeHtml(null), "");
});
