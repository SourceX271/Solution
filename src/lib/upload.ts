import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Server-side half of the upload pipeline: writing and removing bytes.
 *
 * The policy (allowed types, size caps, sniffing, validation) lives in
 * `src/lib/upload-shared.ts` so client components can use it without pulling
 * `fs` into the browser bundle. This module re-exports it for the API route, so
 * server code has a single import.
 */
export * from "./upload-shared";

export interface StoredUpload {
  /** Public URL, e.g. `/uploads/attachments/2026/10/<uuid>.png`. */
  url: string;
  absolutePath: string;
}

/**
 * Write the bytes under `public/uploads/`.
 *
 * Content uploads are date-sharded (so one directory never holds everything),
 * avatars keep their own folder for backwards compatibility.
 */
export async function storeUpload(params: {
  buffer: Buffer;
  extension: string;
  scope: "avatar" | "attachment";
}): Promise<StoredUpload> {
  const { buffer, extension, scope } = params;
  const filename = `${randomUUID()}.${extension}`;

  const now = new Date();
  const relativeDir =
    scope === "avatar"
      ? path.join("uploads", "avatars")
      : path.join(
          "uploads",
          "attachments",
          String(now.getFullYear()),
          String(now.getMonth() + 1).padStart(2, "0")
        );

  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, filename);
  await writeFile(absolutePath, buffer);

  return { url: `/${relativeDir.split(path.sep).join("/")}/${filename}`, absolutePath };
}

/**
 * Map a stored URL back to a path inside `public/`.
 *
 * Returns `null` for anything that is not a plain `/uploads/...` URL, so a
 * delete request can never be talked into removing an arbitrary file.
 */
export function uploadUrlToPath(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  if (url.includes("..") || url.includes("\\") || url.includes("\0")) return null;
  const relative = url.replace(/^\/+/, "");
  const absolute = path.join(process.cwd(), "public", relative);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  if (!absolute.startsWith(uploadsRoot + path.sep)) return null;
  return absolute;
}

/** Best-effort file removal; a missing file is not an error. */
export async function removeStoredUpload(url: string): Promise<void> {
  const absolute = uploadUrlToPath(url);
  if (!absolute) return;
  try {
    await unlink(absolute);
  } catch {
    // Already gone.
  }
}
