/**
 * Regression guard for Markdown source mode and syntax highlighting.
 *
 * Both pipelines had a silent-failure mode:
 *
 *   - Turndown's built-in rules win over `keep()`, so `## 标题` with
 *     `style="text-align: center"` lost its alignment, and attachment anchors
 *     were turned into plain links (see `src/lib/editor-markdown.ts`);
 *   - `highlightHtmlContent()` only matched a bare `<pre>`, but the editor emits
 *     `<pre class="code-block">`, so editor-authored code blocks were never
 *     highlighted.
 *
 * Run with `npm run markdown:check`.
 */
import { htmlToMarkdown, markdownToHtml } from "../src/lib/editor-markdown";
import { highlightHtmlContent } from "../src/lib/highlight";
import { countTextStats } from "../src/lib/text-stats";

type Case = { name: string; pass: boolean; detail?: string };

const cases: Case[] = [];
const check = (name: string, pass: boolean, detail?: string) => {
  cases.push({ name, pass, detail });
};

// ─── Markdown round trip ────────────────────────────────────────────────────

const roundTripCases: Array<{ name: string; input: string; expect: (out: string) => boolean }> = [
  {
    name: "inline style survives",
    input: '<p>前 <span style="color: #dc2626; font-size: 20px">红字</span> 后</p>',
    expect: (html) => html.includes("color: #dc2626") && html.includes("font-size: 20px"),
  },
  {
    name: "block alignment survives (heading)",
    input: '<h2 style="text-align: center" id="t">标题</h2>',
    expect: (html) => html.includes("text-align: center"),
  },
  {
    name: "block alignment survives (paragraph)",
    input: '<p style="text-align: right">右</p>',
    expect: (html) => html.includes("text-align: right"),
  },
  {
    name: "background highlight survives",
    input: '<p><span style="background-color: #fef08a">高亮</span></p>',
    expect: (html) => html.includes("background-color"),
  },
  {
    name: "video survives",
    input: '<p><video controls="true" preload="metadata" src="/uploads/a.mp4"></video></p>',
    expect: (html) => html.includes("<video") && html.includes("/uploads/a.mp4"),
  },
  {
    name: "attachment metadata survives",
    input:
      '<p><a href="/uploads/r.pdf" download="true" data-attachment="id1" data-filename="report.pdf" data-size="2048" data-kind="pdf">report.pdf</a></p>',
    expect: (html) =>
      html.includes("data-attachment") && html.includes("data-filename") && html.includes("data-size"),
  },
  {
    name: "mark/sup/sub/u survive",
    input: "<p><mark>高亮</mark> H<sub>2</sub>O 与 x<sup>2</sup> 和 <u>下划线</u></p>",
    expect: (html) => ["<mark>", "<sub>", "<sup>", "<u>"].every((tag) => html.includes(tag)),
  },
  {
    name: "plain Markdown stays native",
    input:
      "<h1>标题</h1><ul><li>一</li><li>二</li></ul><p><strong>粗</strong> 与 <em>斜</em> 与 <code>x</code></p>",
    expect: (html) =>
      html.includes("<h1>") && html.includes("<li>") && html.includes("<strong>") && !html.includes("style="),
  },
  {
    name: "code block keeps its language",
    input: '<pre class="code-block"><code class="language-js">const a = 1;</code></pre>',
    expect: (html) => html.includes('class="language-js"') && html.includes("const a = 1;"),
  },
  {
    name: "links stay links",
    input: '<p><a href="https://example.test">example</a></p>',
    expect: (html) => html.includes('href="https://example.test"') && html.includes("example"),
  },
];

for (const test of roundTripCases) {
  const markdown = htmlToMarkdown(test.input);
  const back = markdownToHtml(markdown);
  check(`md: ${test.name}`, test.expect(back), `md=${JSON.stringify(markdown)} html=${back}`);
}

// Formulas are kept as their `data-math` node: rewriting them to `$…$` first let
// Turndown escape the backslashes (`\frac` → `\\frac`), which is different LaTeX.
const formulaHtml =
  '<p>体积 <span data-math="inline" data-latex="V=\\frac{4}{3}" class="math-inline"></span> 结束</p>';
const formulaMarkdown = htmlToMarkdown(formulaHtml);
const formulaBack = markdownToHtml(formulaMarkdown);
check(
  "md: formula node survives verbatim",
  formulaBack.includes('data-latex="V=\\frac{4}{3}"') && !formulaBack.includes("\\\\frac"),
  `md=${JSON.stringify(formulaMarkdown)} html=${formulaBack}`
);

// ─── highlighting ───────────────────────────────────────────────────────────

async function highlighting() {
  const editorCode = '<pre class="code-block"><code class="language-js">const a = 1;</code></pre>';
  const out = await highlightHtmlContent(editorCode);
  check(
    "highlight: editor code block is highlighted",
    out.includes('class="hljs language-js"') && out.includes("hljs-keyword"),
    out
  );

  const bare = await highlightHtmlContent("<pre><code>const a = 1;</code></pre>");
  check("highlight: bare pre still highlighted", bare.includes('class="hljs'), bare);

  const typed = await highlightHtmlContent('<pre><code class="language-python">def f(): pass</code></pre>');
  check(
    "highlight: language from code class",
    typed.includes("language-python") && typed.includes("hljs-keyword"),
    typed
  );

  const unknown = await highlightHtmlContent('<pre><code class="language-nosuchlang">x = 1</code></pre>');
  check("highlight: unknown language falls back", unknown.includes('class="hljs'), unknown);

  const escaped = await highlightHtmlContent("<pre><code>&lt;div&gt;</code></pre>");
  check(
    "highlight: entities are decoded once",
    escaped.includes("&lt;div&gt;") && !escaped.includes("&amp;lt;"),
    escaped
  );
}

// ─── text statistics ────────────────────────────────────────────────────────

const cjk = countTextStats("你好世界");
check("stats: cjk counts per character", cjk.characters === 4 && cjk.words === 4, JSON.stringify(cjk));

const mixed = countTextStats("hello world 你好");
check("stats: mixed script", mixed.characters === 12 && mixed.words === 4, JSON.stringify(mixed));

const spaced = countTextStats("a b\n c ");
check("stats: whitespace excluded from characters", spaced.characters === 3, JSON.stringify(spaced));

async function main() {
  await highlighting();

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
