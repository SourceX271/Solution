import { contentPurifyConfig, installContentSanitizer } from "./sanitize-config";

let purify: any = null;

async function getPurifier() {
  if (!purify) {
    if (typeof window !== "undefined") {
      const mod = await import("dompurify");
      purify = mod.default;
    } else {
      const mod = await import("isomorphic-dompurify");
      purify = mod.default;
    }
    // `style`/`class` are rewritten to the shared allow-lists here; DOMPurify on
    // its own accepts the whole attribute value (it does not parse CSS).
    installContentSanitizer(purify);
  }
  return purify;
}

/**
 * Sanitise user-supplied HTML.
 *
 * The allow-list lives in `./sanitize-config` so the editor preview applies the
 * identical rules; CSS inside `style` is filtered declaration by declaration by
 * `./rich-text-styles`.
 */
export async function sanitizeHtml(html: string): Promise<string> {
  if (!html) return "";
  try {
    const p = await getPurifier();
    return p.sanitize(html, contentPurifyConfig());
  } catch {
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
}

export function sanitizePlainText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
