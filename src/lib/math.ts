import katex from "katex";

/**
 * LaTeX rendering shared by the reader (server components) and the editor.
 *
 * Two shapes are supported, because content arrives from two directions:
 *
 * 1. **Editor nodes** — `<span data-math="inline" data-latex="…">` /
 *    `<div data-math="block" data-latex="…">`, produced by the Tiptap math
 *    extensions. The LaTeX source travels in an attribute so the node survives
 *    a save/load round trip and can be edited again.
 * 2. **Plain delimiters** — `$…$`, `$$…$$`, `\(…\)`, `\[…\]` typed by hand or
 *    imported from Markdown/seed data.
 *
 * Rendering happens **after** sanitisation on purpose: KaTeX escapes its own
 * output (`trust: false`), and rendering first would either get stripped by the
 * allow-list or force us to allow KaTeX's inline `style` attributes on
 * user-supplied markup.
 */

/** Cheap pre-check so pages without formulas never pay for KaTeX. */
const MATH_HINT = /\$|\\\(|\\\[|data-math=/i;

export function hasMathSyntax(html: string): boolean {
  return MATH_HINT.test(html);
}

export function renderLatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      // \href and friends stay disabled: formulas must not be able to smuggle
      // links or raw HTML into the page.
      trust: false,
    });
  } catch {
    return escapeHtml(latex);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Matches a complete tag, allowing `>` inside quoted attribute values. */
const TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const SKIP_TAGS = new Set(["code", "pre"]);

/**
 * Inline delimiters, guarded against the common false positives:
 * `$5 and $10` must stay prose (no space before the closing `$`), and a `$`
 * that follows another `$` belongs to a `$$…$$` block, which is handled first.
 */
const INLINE_DELIMITER_RE = /(?<!\$)(?<!\\)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g;
const BLOCK_DELIMITER_RE = /(?<!\\)\$\$([\s\S]+?)\$\$/g;
const PAREN_DELIMITER_RE = /\\\(([\s\S]+?)\\\)/g;
const BRACKET_DELIMITER_RE = /\\\[([\s\S]+?)\\\]/g;

function replaceDelimiters(text: string): string {
  return text
    .replace(BLOCK_DELIMITER_RE, (whole, latex: string) =>
      latex.trim() ? renderLatex(decodeEntities(latex).trim(), true) : whole
    )
    .replace(BRACKET_DELIMITER_RE, (whole, latex: string) =>
      latex.trim() ? renderLatex(decodeEntities(latex).trim(), true) : whole
    )
    .replace(PAREN_DELIMITER_RE, (whole, latex: string) =>
      latex.trim() ? renderLatex(decodeEntities(latex).trim(), false) : whole
    )
    .replace(INLINE_DELIMITER_RE, (whole, latex: string) =>
      latex.trim() ? renderLatex(decodeEntities(latex).trim(), false) : whole
    );
}

/** Walk the string tag by tag and only touch text outside `<code>`/`<pre>`. */
function renderTextDelimiters(html: string): string {
  let out = "";
  let cursor = 0;
  let skipDepth = 0;

  for (const match of html.matchAll(TAG_RE)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const text = html.slice(cursor, index);
    out += skipDepth > 0 ? text : replaceDelimiters(text);
    out += tag;
    cursor = index + tag.length;

    const parsed = /^<(\/?)\s*([a-zA-Z0-9-]+)/.exec(tag);
    if (parsed && SKIP_TAGS.has(parsed[2].toLowerCase())) {
      if (parsed[1] === "/") skipDepth = Math.max(0, skipDepth - 1);
      else if (!tag.endsWith("/>")) skipDepth += 1;
    }
  }

  const tail = html.slice(cursor);
  out += skipDepth > 0 ? tail : replaceDelimiters(tail);
  return out;
}

const MATH_ELEMENT_RE =
  /<(span|div)\b([^>]*\bdata-math=(?:"(?:inline|block)"|'(?:inline|block)'|(?:inline|block))[^>]*)>[\s\S]*?<\/\1>/gi;

function expandMathElements(html: string): string {
  return html.replace(MATH_ELEMENT_RE, (whole, _tag: string, attrs: string) => {
    const kind = /data-math=(?:"(inline|block)"|'(inline|block)'|(inline|block))/i.exec(attrs);
    const latexAttr = /data-latex=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const latex = decodeEntities(latexAttr?.[1] ?? latexAttr?.[2] ?? latexAttr?.[3] ?? "");
    if (!latex.trim()) return whole;
    const kindValue = (kind?.[1] ?? kind?.[2] ?? kind?.[3] ?? "inline").toLowerCase();
    return renderLatex(latex.trim(), kindValue === "block");
  });
}

/**
 * Replace every formula in an already-sanitised HTML string with KaTeX markup.
 * Kept synchronous and dependency-free so both server components and the
 * editor preview can call it.
 */
export function renderMathInHtml(html: string): string {
  if (!html || !hasMathSyntax(html)) return html;
  try {
    return expandMathElements(renderTextDelimiters(html));
  } catch (error) {
    console.error("[math] failed to render formulas", error);
    return html;
  }
}

/**
 * Inverse of the element branch of `renderMathInHtml`: turn `<span data-math>`
 * nodes back into `$…$` / `$$…$$` text.
 *
 * The Markdown source view needs this because turndown cannot see custom nodes
 * (it dropped them, so a trip through Markdown silently deleted every formula).
 */
export function mathElementsToDelimiters(html: string): string {
  if (!html || !html.includes("data-math=")) return html;
  return html.replace(MATH_ELEMENT_RE, (whole, _tag: string, attrs: string) => {
    const kind = /data-math=(?:"(inline|block)"|'(inline|block)'|(inline|block))/i.exec(attrs);
    const latexAttr = /data-latex=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const latex = decodeEntities(latexAttr?.[1] ?? latexAttr?.[2] ?? latexAttr?.[3] ?? "");
    if (!latex.trim()) return whole;
    const kindValue = (kind?.[1] ?? kind?.[2] ?? kind?.[3] ?? "inline").toLowerCase();
    return kindValue === "block" ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
  });
}
