/**
 * Markdown mode for the editor.
 *
 * The reader-facing pipeline is `src/lib/render.ts` (stored HTML/Markdown → HTML
 * → sanitise → highlight); this module is the *editing* direction and has one
 * job: a trip through Markdown source mode must not quietly delete what the
 * author wrote.
 *
 * Plain Turndown cannot do that:
 *
 *   - its built-in rules run **before** anything registered with `keep()`, so
 *     `## 标题` is converted by the heading rule and `style="text-align: center"`
 *     disappears, and attachment anchors become `[name](url)`, losing metadata;
 *   - empty elements never reach any rule at all: `forNode()` short-circuits to
 *     `blankRule` when a node has no text, which is exactly what a formula node
 *     (`<span data-math …></span>`) looks like.
 *
 * So elements carrying inline styling, media, attachments or formulas are
 * registered as an `addRule` (front of the rule list) **and** handled in
 * `blankReplacement`, and are emitted as raw HTML. Inline/block raw HTML is valid
 * CommonMark and `marked` passes it through untouched, so the round trip is
 * lossless.
 */

import TurndownService from "turndown";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

/** Tags with no Markdown syntax; kept verbatim as inline HTML. */
export const MARKDOWN_KEEP_TAGS: readonly string[] = [
  "video",
  "audio",
  "mark",
  "sup",
  "sub",
  "u",
  "small",
  "font",
  "figure",
  "figcaption",
];

/** Turndown mutates the DOM node with these flags while walking the tree. */
interface TurndownNode extends HTMLElement {
  isBlock?: boolean;
}

/**
 * Everything Markdown cannot express is kept as-is: styled elements, media,
 * attachment chips (`data-attachment`) and formula nodes (`data-math`).
 *
 * Rewriting formulas to `$…$` first is *not* an option: Turndown escapes
 * backslashes in text, so `\frac{1}{2}` came back as `\\frac{1}{2}`, a different
 * and broken LaTeX command. Authors can still type `$x$` by hand — the editor's
 * input rule converts it when the content returns to rich text.
 */
function shouldKeepRawHtml(node: HTMLElement): boolean {
  if (MARKDOWN_KEEP_TAGS.includes(node.nodeName.toLowerCase())) return true;
  if (node.getAttribute("style")) return true;
  if (node.hasAttribute("data-math")) return true;
  return node.nodeName === "A" && node.getAttribute("data-attachment") !== null;
}

/** Mirrors Turndown's own `keepReplacement`, which is not exported. */
function keepRawHtml(node: HTMLElement): string {
  const html = node.outerHTML;
  return (node as TurndownNode).isBlock ? `\n\n${html}\n\n` : html;
}

/** Turndown's default `blankReplacement`. */
function blankHtml(node: HTMLElement): string {
  return (node as TurndownNode).isBlock ? "\n\n" : "";
}

let service: TurndownService | null = null;

export function getTurndownService(): TurndownService {
  if (service) return service;

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    // Reached for every element with no text content, before any rule can match.
    blankReplacement: (_content, node) =>
      shouldKeepRawHtml(node) ? keepRawHtml(node) : blankHtml(node),
  });

  turndown.addRule("keptHtml", {
    filter: (node) => shouldKeepRawHtml(node),
    replacement: (_content, node) => keepRawHtml(node),
  });

  service = turndown;
  return service;
}

/** Editor HTML → Markdown source. Returns the input unchanged if Turndown fails. */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  try {
    return getTurndownService().turndown(html) || "";
  } catch {
    return html;
  }
}

/** Markdown source → editor HTML. Returns "" if the parse fails. */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  try {
    return (marked.parse(markdown) as string) || "";
  } catch {
    return "";
  }
}
