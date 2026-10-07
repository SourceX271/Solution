/**
 * Upload policy — the parts that are safe in the browser bundle.
 *
 * The rules, the sniffer and the validators are pure functions, so the API
 * route, the editor (`accept` attribute, size hints) and the tests all agree on
 * one definition. Filesystem work lives in `src/lib/upload.ts`, which is
 * server-only: importing that module from a client component drags `fs/promises`
 * into the browser bundle and the build fails with "Module not found".
 */

export type UploadKind = "image" | "video" | "audio" | "pdf" | "archive" | "document";

export interface UploadRule {
  kind: UploadKind;
  /** Declared MIME types accepted for this kind (bytes are verified separately). */
  mimes: string[];
  /** Extensions we may write, derived from the sniffed signature. */
  extensions: string[];
  maxBytes: number;
}

const MB = 1024 * 1024;

export const UPLOAD_RULES: UploadRule[] = [
  {
    kind: "image",
    // No SVG: it is a script container, not a picture. `image/avif` is fine.
    mimes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"],
    extensions: ["jpg", "png", "gif", "webp", "avif"],
    maxBytes: 8 * MB,
  },
  {
    kind: "video",
    mimes: ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"],
    extensions: ["mp4", "webm", "mov"],
    maxBytes: 64 * MB,
  },
  {
    kind: "audio",
    mimes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac", "audio/x-flac"],
    extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac"],
    maxBytes: 16 * MB,
  },
  {
    kind: "pdf",
    mimes: ["application/pdf"],
    extensions: ["pdf"],
    maxBytes: 24 * MB,
  },
  {
    kind: "archive",
    mimes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-7z-compressed",
      "application/vnd.rar",
      "application/x-rar-compressed",
      "application/gzip",
      "application/x-gzip",
      "application/x-tar",
    ],
    extensions: ["zip", "7z", "rar", "gz", "tar"],
    maxBytes: 24 * MB,
  },
  {
    kind: "document",
    mimes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ],
    extensions: ["docx", "xlsx", "pptx", "txt", "md", "csv", "json"],
    maxBytes: 24 * MB,
  },
];

/** Avatars stay image-only and small, regardless of the general image cap. */
export const AVATAR_MAX_BYTES = 2 * MB;

export function findRuleByMime(mime: string): UploadRule | undefined {
  return UPLOAD_RULES.find((rule) => rule.mimes.includes(mime));
}

export function findRuleByKind(kind: string): UploadRule | undefined {
  return UPLOAD_RULES.find((rule) => rule.kind === kind);
}

export interface SniffedFile {
  kind: UploadKind;
  extension: string;
}

const startsWith = (buffer: Buffer, bytes: number[]) =>
  buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

/**
 * Identify a file from its leading bytes.
 *
 * Returns `null` for anything unrecognised — including HTML/JS renamed to `.pdf`
 * or a spreadsheet uploaded with `Content-Type: image/png`.
 */
export function sniffFile(buffer: Buffer): SniffedFile | null {
  if (buffer.length < 8) return null;
  const ascii = (start: number, end: number) => buffer.toString("ascii", start, Math.min(end, buffer.length));
  const isoBrand = ascii(4, 8) === "ftyp" ? ascii(8, 12) : "";

  // ---- images ----
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { kind: "image", extension: "jpg" };
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image", extension: "png" };
  if (ascii(0, 4) === "GIF8") return { kind: "image", extension: "gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", extension: "webp" };
  if (isoBrand === "avif" || isoBrand === "avis") return { kind: "image", extension: "avif" };

  // ---- pdf ----
  if (ascii(0, 5) === "%PDF-") return { kind: "pdf", extension: "pdf" };

  // ---- zip family (Office files are zips with a marker directory) ----
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])) {
    const head = ascii(0, 8192);
    if (head.includes("word/")) return { kind: "document", extension: "docx" };
    if (head.includes("xl/")) return { kind: "document", extension: "xlsx" };
    if (head.includes("ppt/")) return { kind: "document", extension: "pptx" };
    return { kind: "archive", extension: "zip" };
  }
  if (startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return { kind: "archive", extension: "7z" };
  if (ascii(0, 4) === "Rar!") return { kind: "archive", extension: "rar" };
  if (startsWith(buffer, [0x1f, 0x8b])) return { kind: "archive", extension: "gz" };
  if (ascii(257, 262) === "ustar") return { kind: "archive", extension: "tar" };

  // ---- video / audio containers ----
  if (isoBrand) {
    if (isoBrand.startsWith("qt")) return { kind: "video", extension: "mov" };
    if (isoBrand.startsWith("M4A") || isoBrand.startsWith("mp4a")) return { kind: "audio", extension: "m4a" };
    return { kind: "video", extension: "mp4" };
  }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", extension: "webm" };
  if (ascii(0, 4) === "OggS") return { kind: "audio", extension: "ogg" };
  if (ascii(0, 3) === "ID3") return { kind: "audio", extension: "mp3" };
  // Raw MPEG frame sync (0xFF 0xE0–0xFF).
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return { kind: "audio", extension: "mp3" };
  if (ascii(0, 4) === "fLaC") return { kind: "audio", extension: "flac" };

  return null;
}

export type UploadRejection = "noFile" | "badType" | "tooLarge" | "badContent";

export type UploadValidation =
  | { ok: true; rule: UploadRule; kind: UploadKind; extension: string }
  | { ok: false; reason: UploadRejection; maxBytes?: number };

/**
 * Validate one upload.
 *
 * Order matters: the declared type picks the rule (so the size cap and the
 * allowed kinds are decided before the body is read), then the bytes must agree
 * with that rule.
 */
export function validateUpload(params: {
  declaredMime: string;
  size: number;
  buffer: Buffer;
  /** Avatar uploads must be an image and honour the smaller cap. */
  avatarOnly?: boolean;
}): UploadValidation {
  const { declaredMime, size, buffer, avatarOnly } = params;
  const rule = findRuleByMime(declaredMime);
  if (!rule) return { ok: false, reason: "badType" };
  if (avatarOnly && rule.kind !== "image") return { ok: false, reason: "badType" };

  const maxBytes = avatarOnly ? AVATAR_MAX_BYTES : rule.maxBytes;
  if (size > maxBytes) return { ok: false, reason: "tooLarge", maxBytes };

  const sniffed = sniffFile(buffer);
  if (!sniffed) return { ok: false, reason: "badContent" };
  // The bytes must belong to the declared kind (a ZIP renamed to .png fails here).
  if (sniffed.kind !== rule.kind) return { ok: false, reason: "badContent" };
  if (!rule.extensions.includes(sniffed.extension)) return { ok: false, reason: "badContent" };

  return { ok: true, rule, kind: sniffed.kind, extension: sniffed.extension };
}

/**
 * Keep a human-readable name for display.
 *
 * Path separators, control characters and leading dots are removed so a crafted
 * name can never influence where the file lands; the stored path is always
 * `uploads/.../<uuid>.<ext>`.
 */
export function sanitizeOriginalName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 200);
  return cleaned || "file";
}

/** `1.4 MB` / `812 KB` / `96 B` — used by the editor and the attachment card. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Canonical MIME type per stored extension (the declared one is caller input). */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  pdf: "application/pdf",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  gz: "application/gzip",
  tar: "application/x-tar",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

export function mimeForExtension(extension: string): string {
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/** Input `accept` attribute covering every allowed kind. */
export const UPLOAD_ACCEPT = [
  ...UPLOAD_RULES.flatMap((rule) => rule.mimes),
  ...UPLOAD_RULES.flatMap((rule) => rule.extensions.map((extension) => `.${extension}`)),
].join(",");
