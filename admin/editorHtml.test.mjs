import { test } from "node:test";
import assert from "node:assert/strict";
import { linkify, tsvToTableHtml, plainTextToHtml, escapeHtml } from "./editorHtml.js";

test("escapeHtml escapes the dangerous trio", () => {
  assert.equal(escapeHtml('a<b>&"'), 'a&lt;b&gt;&amp;&quot;');
});

test("linkify wraps bare urls, leaves text alone", () => {
  assert.equal(linkify("see https://a.com now"),
    'see <a href="https://a.com">https://a.com</a> now');
  assert.equal(linkify("no links here"), "no links here");
});

test("linkify does not double-wrap and escapes surrounding text", () => {
  assert.equal(linkify("a & https://x.com"), 'a &amp; <a href="https://x.com">https://x.com</a>');
});

test("tsvToTableHtml builds a table; first row is a header", () => {
  const html = tsvToTableHtml("a\tb\n1\t2");
  assert.equal(html,
    "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
});

test("tsvToTableHtml escapes cell content and ignores trailing blank lines", () => {
  const html = tsvToTableHtml("x<i>\ty\n\n");
  assert.match(html, /<th>x&lt;i&gt;<\/th>/);
});

test("tsvToTableHtml returns empty string when there is no tab", () => {
  assert.equal(tsvToTableHtml("just one line no tabs"), "");
});

test("plainTextToHtml wraps blocks in <p>, single newline -> <br>", () => {
  assert.equal(plainTextToHtml("one\ntwo\n\nthree"), "<p>one<br>two</p><p>three</p>");
  assert.equal(plainTextToHtml(""), "");
});

test("plainTextToHtml leaves existing block HTML untouched", () => {
  assert.equal(plainTextToHtml("<p>hi</p>"), "<p>hi</p>");
});
