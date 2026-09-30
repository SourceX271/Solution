import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

/** Matches an opening HTML tag such as `<p>`, `<h2 class="x">`, `<br/>`. */
const HTML_TAG_RE = /<([a-z][a-z0-9]*)\b[^>]*>/i;

/**
 * Normalise stored content for rendering.
 *
 * Content created through the rich-text editor is already HTML, while seed data
 * and some imported/crawled rows are Markdown or plain text. Rendering those
 * verbatim printed the Markdown syntax (`## 标题`) to readers, so detect the
 * format first. The result is always sanitised by the caller before it reaches
 * the DOM.
 */
export function toRenderableHtml(content: string): string {
  if (!content) return "";
  if (HTML_TAG_RE.test(content)) return content;

  try {
    return marked.parse(content) as string;
  } catch {
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
