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
  }
  return purify;
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "strong", "b", "em", "i", "s", "u", "mark",
    "a", "img",
    // Inline media uploaded through /api/upload. SVG stays out of the image
    // list on purpose: it is a script container, not a picture.
    "video", "audio",
    "code", "pre",
    "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "div", "span",
    "input", "label",
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel",
    // `download` makes the browser save attachments instead of navigating to
    // them (PDF/archive previews would otherwise render on our own origin).
    "download",
    "src", "alt", "width", "height", "loading",
    "controls", "poster", "preload", "playsinline", "muted", "loop",
    "class", "id", "style",
    "type", "checked", "disabled",
    "data-language",
  ],
  ALLOW_DATA_ATTR: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:|\/|#)/i,
};

export async function sanitizeHtml(html: string): Promise<string> {
  if (!html) return "";
  try {
    const p = await getPurifier();
    return p.sanitize(html, PURIFY_CONFIG);
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
