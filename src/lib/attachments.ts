/**
 * Attachment cards.
 *
 * The editor stores an attachment as an anchor carrying its metadata
 * (`data-attachment` / `data-filename` / `data-size` / `data-kind`). Rendering
 * that verbatim gives readers a long UUID link, so the stored anchor is expanded
 * into a card *after* sanitisation — the same "trusted markup after the
 * sanitiser" rule the LaTeX pipeline follows.
 */

export interface AttachmentCardLabels {
  /** Localized word for the download affordance, e.g. 下载 / Download. */
  download: string;
  /** Localized kind names; unknown kinds fall back to the raw kind. */
  kinds: Record<string, string>;
}

/** Matches one stored attachment anchor, whatever attribute order the editor used. */
const ATTACHMENT_ANCHOR_RE =
  /<a\b([^>]*\bdata-attachment=(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*)>([\s\S]*?)<\/a>/gi;

const ICONS: Record<string, string> = {
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  pdf: "📄",
  archive: "🗜️",
  document: "📎",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function readAttr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  if (!match) return null;
  return decodeEntities(match[1] ?? match[2] ?? match[3] ?? "");
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Expand every attachment anchor into a download card.
 *
 * Anchors without a usable `href` are left untouched (a broken card is worse
 * than the original link).
 */
export function renderAttachmentCards(html: string, labels: AttachmentCardLabels): string {
  if (!html || !html.includes("data-attachment=")) return html;

  return html.replace(ATTACHMENT_ANCHOR_RE, (whole, attrs: string) => {
    const href = readAttr(attrs, "href");
    if (!href) return whole;

    const filename = readAttr(attrs, "data-filename") || readAttr(attrs, "data-attachment") || labels.download;
    const kind = (readAttr(attrs, "data-kind") || "document").toLowerCase();
    const size = Number(readAttr(attrs, "data-size") ?? 0);
    const sizeLabel = formatSize(size);
    const kindLabel = labels.kinds[kind] ?? kind;
    const meta = sizeLabel ? `${kindLabel} · ${sizeLabel}` : kindLabel;

    return (
      `<a class="attachment-card" href="${escapeHtml(href)}" download data-kind="${escapeHtml(kind)}"` +
      ` rel="noopener noreferrer">` +
      `<span class="attachment-card__icon" aria-hidden="true">${ICONS[kind] ?? ICONS.document}</span>` +
      `<span class="attachment-card__body">` +
      `<span class="attachment-card__name">${escapeHtml(filename)}</span>` +
      `<span class="attachment-card__meta">${escapeHtml(meta)}</span>` +
      `</span>` +
      `<span class="attachment-card__action">${escapeHtml(labels.download)}</span>` +
      `</a>`
    );
  });
}
