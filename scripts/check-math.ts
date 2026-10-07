import { hasMathSyntax, mathElementsToDelimiters, renderMathInHtml } from "../src/lib/math";

interface Case {
  name: string;
  run: () => { out: string; expect: (out: string) => boolean };
}

const renderCases: Array<{ name: string; input: string; expect: (out: string) => boolean }> = [
  { name: "inline $…$", input: "<p>质能方程 $E=mc^2$ 很有意思</p>", expect: (h) => h.includes('class="katex"') && !h.includes("$E=mc^2$") },
  { name: "block $$…$$", input: "<p>$$\\int_0^1 x^2 dx$$</p>", expect: (h) => h.includes("katex-display") },
  { name: "escaped \\(…\\)", input: "<p>\\(a^2+b^2=c^2\\)</p>", expect: (h) => h.includes('class="katex"') },
  { name: "bracket \\[…\\]", input: "<p>\\[\\sum_{i=1}^n i\\]</p>", expect: (h) => h.includes("katex-display") },
  { name: "prices are not math", input: "<p>It costs $5 and $10 today</p>", expect: (h) => !h.includes("katex") && h.includes("$5 and $10") },
  { name: "code blocks skipped", input: "<pre><code>echo $PATH and $HOME</code></pre>", expect: (h) => !h.includes("katex") },
  { name: "inline code skipped", input: "<p>Use <code>$x$</code> to write math</p>", expect: (h) => !h.includes("katex") },
  { name: "editor inline node", input: '<p><span data-math="inline" data-latex="a &lt; b \\frac{1}{2}"></span></p>', expect: (h) => h.includes('class="katex"') },
  { name: "editor block node", input: '<div data-math="block" data-latex="E=mc^2"></div>', expect: (h) => h.includes("katex-display") },
  { name: "invalid latex survives", input: "<p>$\\frac{1}{$</p>", expect: (h) => typeof h === "string" && h.length > 0 },
  { name: "no math untouched", input: "<p>普通段落，没有公式</p>", expect: (h) => h === "<p>普通段落，没有公式</p>" },
  { name: "trust disabled", input: "<p>$\\href{javascript:alert(1)}{x}$</p>", expect: (h) => !h.includes("javascript:") || !h.includes("<a ") },
  { name: "$$ blocks win over inline", input: "<p>$$a$$ and $$b$$</p>", expect: (h) => (h.match(/katex-display/g) || []).length >= 2 },
];

const delimiterCases: Array<{ name: string; input: string; expect: (out: string) => boolean }> = [
  {
    name: "inline node → $…$",
    input: '<p>体积 <span data-latex="V=\\frac{4}{3}" data-math="inline" class="math-inline"></span> 结束</p>',
    expect: (out) => out.includes("$V=\\frac{4}{3}$") && out.includes("体积") && out.includes("结束"),
  },
  { name: "block node → $$…$$", input: '<div data-math="block" data-latex="E=mc^2" class="math-block"></div>', expect: (out) => out.includes("$$E=mc^2$$") },
  { name: "escaped latex round-trips", input: '<p><span data-math="inline" data-latex="a &lt; b"></span></p>', expect: (out) => out.includes("$a < b$") },
  { name: "no math untouched", input: "<p>普通段落</p>", expect: (out) => out === "<p>普通段落</p>" },
  { name: "round trip back to KaTeX", input: '<p>x <span data-math="inline" data-latex="a^2"></span></p>', expect: (out) => renderMathInHtml(out).includes('class="katex"') },
];

let failures = 0;
for (const test of renderCases) {
  const out = renderMathInHtml(test.input);
  const ok = test.expect(out);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  render: ${test.name}${ok ? "" : `\n      in : ${test.input}\n      out: ${out.slice(0, 200)}`}`);
}
for (const test of delimiterCases) {
  const out = mathElementsToDelimiters(test.input);
  const ok = test.expect(out);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  delims: ${test.name}${ok ? "" : `\n      in : ${test.input}\n      out: ${out}`}`);
}

console.log(`\nhasMathSyntax: ${hasMathSyntax("<p>$x$</p>")} / ${hasMathSyntax("<p>plain</p>")}`);
const total = renderCases.length + delimiterCases.length;
console.log(`${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} (${total} cases)`);
process.exit(failures === 0 ? 0 : 1);
