/**
 * The DOMPurify configuration shared by the server-side `sanitizeHtml()` and the
 * client-side editor preview.
 *
 * Both must agree: a preview built with a laxer allow-list than the renderer
 * shows authors formatting that will disappear once published (and the other way
 * round), which is exactly the "my HTML lost its styling" class of bug.
 *
 * `style` and `class` are accepted by DOMPurify but then rewritten by the hook in
 * `installContentSanitizer()`: DOMPurify does not parse CSS at all, so without
 * that hook an allow-listed `style` attribute would let content ship
 * `position: fixed; inset: 0` (a full-page click interceptor) or a
 * `background-image: url(...)` beacon. See `@/lib/rich-text-styles` for the
 * vocabulary and `docs/security.md` for the rationale.
 */

import { filterClassAttribute, filterStyleDeclarations } from "./rich-text-styles";

export const CONTENT_ALLOWED_TAGS: readonly string[] = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  // `mark`/`small`/`sub`/`sup` are what the editor's marks serialise to.
  "strong", "b", "em", "i", "s", "u", "mark", "small", "sub", "sup",
  "a", "img",
  // Inline media uploaded through /api/upload. SVG stays out of the image list
  // on purpose: it is a script container, not a picture.
  "video", "audio",
  "code", "pre",
  "blockquote",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "div", "span",
  // Legacy presentational markup pasted from Word or older editors. Browsers
  // still render these, so keeping them preserves the author's intent instead of
  // flattening it. The editor upgrades them to inline styles on import.
  "font", "center", "figure", "figcaption", "dl", "dt", "dd",
  "input", "label",
];

export const CONTENT_ALLOWED_ATTR: readonly string[] = [
  "href", "target", "rel",
  // `download` makes the browser save attachments instead of navigating to them
  // (PDF/archive previews would otherwise render on our own origin).
  "download",
  "src", "alt", "width", "height", "loading",
  "controls", "poster", "preload", "playsinline", "muted", "loop",
  "class", "id", "style",
  "type", "checked", "disabled",
  "data-language",
  // Presentational-only legacy attributes (no URI, no script surface).
  "align", "color", "size", "face", "bgcolor",
];

export const CONTENT_ALLOWED_URI_REGEXP = /^(?:(?:https?|ftp):\/\/|mailto:|tel:|\/|#)/i;

/**
 * DOMPurify runs `ALLOWED_URI_REGEXP` over every attribute that is not in its
 * internal "the value is not a URI" list, so `align="center"` and `size="5"`
 * would be dropped even though they are allow-listed. Declaring them here keeps
 * the legacy presentational attributes usable without widening the URI policy.
 */
export const CONTENT_URI_SAFE_ATTR: readonly string[] = ["align", "color", "size", "face", "bgcolor"];

/** Fresh object per call: DOMPurify may keep a reference to the config. */
export function contentPurifyConfig() {
  return {
    ALLOWED_TAGS: [...CONTENT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...CONTENT_ALLOWED_ATTR],
    ADD_URI_SAFE_ATTR: [...CONTENT_URI_SAFE_ATTR],
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: CONTENT_ALLOWED_URI_REGEXP,
  };
}

interface SanitizeAttributeEvent {
  attrName: string;
  attrValue: string;
  keepAttr: boolean;
}

interface PurifierWithHooks {
  addHook(
    name: "uponSanitizeAttribute",
    handler: (node: unknown, data: SanitizeAttributeEvent) => void
  ): void;
}

const hooked = new WeakSet<object>();

/**
 * Rewrite `style` and `class` down to the allow-lists. Idempotent: the hook is
 * attached once per purifier instance, so calling this on every request is safe
 * (re-attaching would filter the same value repeatedly).
 */
export function installContentSanitizer(purifier: PurifierWithHooks): void {
  if (hooked.has(purifier as object)) return;
  hooked.add(purifier as object);

  purifier.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") {
      const filtered = filterStyleDeclarations(data.attrValue);
      if (!filtered) {
        data.keepAttr = false;
        return;
      }
      data.attrValue = filtered;
      return;
    }

    if (data.attrName === "class") {
      const filtered = filterClassAttribute(data.attrValue);
      if (!filtered) {
        data.keepAttr = false;
        return;
      }
      data.attrValue = filtered;
    }
  });
}
