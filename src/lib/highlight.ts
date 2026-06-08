import hljs from "highlight.js";

// Import common languages
import "highlight.js/lib/languages/javascript";
import "highlight.js/lib/languages/typescript";
import "highlight.js/lib/languages/python";
import "highlight.js/lib/languages/css";
import "highlight.js/lib/languages/xml";
import "highlight.js/lib/languages/bash";
import "highlight.js/lib/languages/json";
import "highlight.js/lib/languages/sql";
import "highlight.js/lib/languages/rust";
import "highlight.js/lib/languages/go";
import "highlight.js/lib/languages/java";
import "highlight.js/lib/languages/c";
import "highlight.js/lib/languages/cpp";
import "highlight.js/lib/languages/csharp";
import "highlight.js/lib/languages/php";
import "highlight.js/lib/languages/ruby";
import "highlight.js/lib/languages/yaml";
import "highlight.js/lib/languages/markdown";
import "highlight.js/lib/languages/shell";
import "highlight.js/lib/languages/dockerfile";
import "highlight.js/lib/languages/nginx";
import "highlight.js/lib/languages/graphql";

// Register all languages
const registered = new Set<string>();

function ensureLanguage(lang: string): void {
  if (!registered.has(lang)) {
    try {
      registered.add(lang);
    } catch {}
  }
}

/**
 * Highlight code on the server or client using highlight.js
 */
export function highlightCode(code: string, language?: string): string {
  const lang = language?.toLowerCase() || "";
  ensureLanguage(lang);

  try {
    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(code.trim(), { language: lang });
      return result.value;
    }
    // Auto-detect language
    const result = hljs.highlightAuto(code.trim());
    return result.value;
  } catch {
    // Fallback: escape HTML
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

/**
 * Process HTML content to apply syntax highlighting to pre/code blocks.
 */
export function highlightHtmlContent(html: string): string {
  return html.replace(
    /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match: string, lang: string | undefined, code: string) => {
      const decoded = code
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"');
      const highlighted = highlightCode(decoded, lang);
      const langLabel = lang ? ' language-' + lang : '';
      return '<pre><code class="hljs' + langLabel + '">' + highlighted + '</code></pre>';
    }
  );
}