/**
 * Guard for the content allow-lists.
 *
 * `src/lib/sanitize.ts` is the only thing between user HTML and the DOM, and its
 * behaviour depends on three things that are easy to break by accident:
 * DOMPurify's configuration, the CSS declaration filter and the class filter.
 * This script exercises all three, including a few payloads that only work if
 * `style`/`class` are passed through unparsed.
 *
 * Run with `npm run sanitize:check`.
 */
import { sanitizeHtml } from "../src/lib/sanitize";
import {
  filterClassAttribute,
  filterStyleDeclarations,
  normalizeCssColor,
} from "../src/lib/rich-text-styles";

type Case = { name: string; pass: boolean; detail?: string };

const cases: Case[] = [];
const check = (name: string, pass: boolean, detail?: string) => {
  cases.push({ name, pass, detail });
};

// ─── style declarations ─────────────────────────────────────────────────────

const styleCases: Array<{ name: string; input: string; expect: string }> = [
  {
    name: "keeps the editor's own formatting",
    input: "color: #2563eb; font-size: 20px; text-align: center",
    expect: "color: #2563eb; font-size: 20px; text-align: center",
  },
  {
    name: "drops overlay positioning",
    input: "position: fixed; top: 0; left: 0; z-index: 9999",
    expect: "",
  },
  {
    name: "drops remote-fetch backgrounds",
    input: "background-image: url(http://evil.test/x.png); color: red",
    expect: "color: red",
  },
  { name: "drops IE expression()", input: "width: expression(alert(1))", expect: "" },
  { name: "drops @import", input: "font-family: @import 'x'", expect: "" },
  { name: "drops CSS comments (injection vector)", input: "color: red /* }; */", expect: "" },
  { name: "strips !important", input: "color: red !important", expect: "color: red" },
  { name: "drops unknown properties", input: "behavior: url(#default#time2); color: red", expect: "color: red" },
  { name: "drops malformed declarations", input: "color; font-size", expect: "" },
  {
    name: "keeps quoted font stacks",
    input: 'font-family: "PingFang SC", sans-serif; background-color: #fef08a',
    expect: 'font-family: "PingFang SC", sans-serif; background-color: #fef08a',
  },
  {
    name: "keeps table borders",
    input: "border: 1px solid #cccccc; border-collapse: collapse",
    expect: "border: 1px solid #cccccc; border-collapse: collapse",
  },
  { name: "rejects invalid values for known properties", input: "text-align: url(x)", expect: "" },
  { name: "keeps line-height presets", input: "line-height: 1.75", expect: "line-height: 1.75" },
];

for (const test of styleCases) {
  const out = filterStyleDeclarations(test.input);
  check(`style: ${test.name}`, out === test.expect, `in=${test.input} out=${out}`);
}

// ─── class tokens ───────────────────────────────────────────────────────────

const classCases: Array<{ name: string; input: string; expect: string }> = [
  { name: "keeps highlighter classes", input: "hljs language-typescript", expect: "hljs language-typescript" },
  { name: "keeps editor node classes", input: "code-block media-video math-inline math-block attachment-inline", expect: "code-block media-video math-inline math-block attachment-inline" },
  { name: "keeps hljs token classes", input: "hljs hljs-keyword", expect: "hljs hljs-keyword" },
  // Tailwind utilities are global, so `fixed inset-0 z-50` would render a real
  // click-intercepting overlay on top of the page.
  { name: "drops Tailwind utility classes", input: "fixed inset-0 z-50 bg-background", expect: "" },
  { name: "drops mixed utilities but keeps ours", input: "hidden code-block absolute", expect: "code-block" },
];

for (const test of classCases) {
  const out = filterClassAttribute(test.input);
  check(`class: ${test.name}`, out === test.expect, `in=${test.input} out=${out}`);
}

// ─── colour normalisation ───────────────────────────────────────────────────
// The toolbar compares a preset against the value ProseMirror stored, and
// ProseMirror renders `style` through CSSOM — `#dc2626` comes back as
// `rgb(220, 38, 38)`. Without normalising, the swatches never light up.

const colorCases: Array<{ name: string; input: string; expect: string }> = [
  { name: "hex passes through", input: "#dc2626", expect: "#dc2626" },
  { name: "rgb to hex", input: "rgb(220, 38, 38)", expect: "#dc2626" },
  { name: "spaced rgb to hex", input: "rgb(37 99 235)", expect: "#2563eb" },
  { name: "short hex expands", input: "#fff", expect: "#ffffff" },
  { name: "fully opaque rgba to hex", input: "rgba(37, 99, 235, 1)", expect: "#2563eb" },
  { name: "translucent rgba stays as written", input: "rgba(0, 0, 0, 0.5)", expect: "rgba(0, 0, 0, 0.5)" },
  { name: "keywords untouched", input: "transparent", expect: "transparent" },
  { name: "empty stays empty", input: "", expect: "" },
];

for (const test of colorCases) {
  const out = normalizeCssColor(test.input);
  check(`color: ${test.name}`, out === test.expect, `in=${test.input} out=${out}`);
}

// ─── full pipeline ──────────────────────────────────────────────────────────

async function pipeline() {
  const htmlCases: Array<{ name: string; input: string; expect: (out: string) => boolean }> = [
    {
      name: "keeps author styling, drops positioning",
      input: '<p style="color: red; position: fixed; inset: 0">hello</p>',
      expect: (out) => out.includes("color: red") && !out.includes("position") && !out.includes("inset"),
    },
    {
      name: "keeps font size and family",
      input: '<span style="font-size: 30px; font-family: KaiTi, serif">big</span>',
      expect: (out) => out.includes("font-size: 30px") && out.includes("KaiTi"),
    },
    {
      name: "keeps alignment via style",
      input: '<p style="text-align: center">mid</p>',
      expect: (out) => out.includes("text-align: center"),
    },
    {
      name: "keeps legacy align attribute",
      input: '<div align="center">legacy</div>',
      expect: (out) => out.includes('align="center"'),
    },
    {
      name: "keeps legacy font tag",
      input: '<font color="red" size="5" face="KaiTi">old</font>',
      expect: (out) => out.includes("<font") && out.includes('color="red"'),
    },
    {
      name: "keeps sub/superscript markup",
      input: "<p>x<sup>2</sup> and H<sub>2</sub>O</p>",
      expect: (out) => out.includes("<sup>2</sup>") && out.includes("<sub>2</sub>"),
    },
    {
      name: "keeps maths and attachment data attributes",
      input: '<p><span data-math="inline" data-latex="a^2" class="math-inline"></span><a href="/uploads/x.pdf" data-attachment="f.pdf" data-kind="pdf" download>x</a></p>',
      expect: (out) => out.includes('data-latex="a^2"') && out.includes('data-attachment="f.pdf"') && out.includes("math-inline"),
    },
    {
      name: "drops the overlay class attack",
      input: '<div class="fixed inset-0 z-50 bg-white">fake login</div>',
      expect: (out) => !out.includes("fixed") && !out.includes("inset-0"),
    },
    {
      name: "removes scripts and event handlers",
      input: '<p onclick="alert(1)">x</p><script>alert(1)</script>',
      expect: (out) => !out.includes("script") && !out.includes("onclick"),
    },
    {
      name: "removes javascript: URLs",
      input: '<a href="javascript:alert(1)">x</a>',
      expect: (out) => !out.includes("javascript:"),
    },
    {
      name: "removes remote background beacons",
      input: '<p style="background-image: url(http://evil.test/pixel)">x</p>',
      expect: (out) => !out.includes("url("),
    },
    {
      name: "drops the attribute entirely when nothing survives",
      input: '<p style="position: fixed">x</p>',
      expect: (out) => !out.includes("style="),
    },
    {
      name: "html source mode round-trips inline styles",
      input: '<h2 style="text-align: right; color: #dc2626" id="a">标题</h2>',
      expect: (out) => out.includes("text-align: right") && out.includes("color: #dc2626"),
    },
  ];

  for (const test of htmlCases) {
    const out = await sanitizeHtml(test.input);
    check(`html: ${test.name}`, test.expect(out), `in=${test.input} out=${out}`);
  }
}

async function main() {
  await pipeline();

  let failures = 0;
  for (const test of cases) {
    if (!test.pass) failures++;
    console.log(
      `${test.pass ? "PASS" : "FAIL"}  ${test.name}${test.pass ? "" : `\n      ${test.detail ?? ""}`}`
    );
  }
  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} (${cases.length} cases)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
