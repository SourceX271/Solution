import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { prisma } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import {
  AVATAR_MAX_BYTES,
  UPLOAD_RULES,
  formatBytes,
  mimeForExtension,
  sanitizeOriginalName,
  storeUpload,
  validateUpload,
} from "@/lib/upload";

/** Content uploads are capped by the largest rule (video, 64 MB). */
const MAX_CONTENT_BYTES = Math.max(...UPLOAD_RULES.map((rule) => rule.maxBytes));
/** A little slack for multipart boundaries and other form fields. */
const MULTIPART_OVERHEAD = 512 * 1024;

/** Normalise the declared `Content-Type` (it is caller input, never trusted). */
function normalizeFile(file: File): { declaredMime: string; name: string } {
  return {
    declaredMime: (file.type || "").split(";")[0]!.trim().toLowerCase(),
    name: file.name || "file",
  };
}

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "upload"), {
      windowMs: 60000,
      maxRequests: 20,
    });
    if (!allowed) {
      return NextResponse.json({ success: false, error: t("uploadTooFrequent") }, { status: 429 });
    }

    // Reject early on the declared body size: `formData()` buffers everything in
    // memory, so there is no point reading a 500 MB body just to say "too large".
    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTENT_BYTES + MULTIPART_OVERHEAD) {
      return NextResponse.json(
        { success: false, error: t("uploadTooLarge", { max: formatBytes(MAX_CONTENT_BYTES) }) },
        { status: 413 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ success: false, error: t("uploadNoFile") }, { status: 400 });
    }

    const file = formData.get("file");
    const purpose = formData.get("purpose") === "avatar" ? "avatar" : "content";

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: t("uploadNoFile") }, { status: 400 });
    }

    const { declaredMime, name } = normalizeFile(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    const size = buffer.length;

    const validation = validateUpload({
      declaredMime,
      size,
      buffer,
      avatarOnly: purpose === "avatar",
    });

    if (!validation.ok) {
      const maxBytes =
        validation.maxBytes ?? (purpose === "avatar" ? AVATAR_MAX_BYTES : undefined);
      const errorKey =
        validation.reason === "tooLarge"
          ? maxBytes
            ? t("uploadTooLarge", { max: formatBytes(maxBytes) })
            : t("uploadTooLargeGeneric")
          : validation.reason === "badType"
            ? t("uploadBadType")
            : validation.reason === "noFile"
              ? t("uploadNoFile")
              : t("uploadBadContent");
      // Oversize is a 413, every other rejection is a plain 400.
      const status = validation.reason === "tooLarge" ? 413 : 400;
      return NextResponse.json({ success: false, error: errorKey }, { status });
    }

    const { kind, extension } = validation;
    const stored = await storeUpload({
      buffer,
      extension,
      scope: purpose === "avatar" ? "avatar" : "attachment",
    });

    // Avatars are a profile field, not content: no Attachment row for them.
    if (purpose === "avatar") {
      return NextResponse.json({ success: true, url: stored.url, kind, size });
    }

    const attachment = await prisma.attachment.create({
      data: {
        uploaderId: (session.user as { id: string }).id,
        url: stored.url,
        originalName: sanitizeOriginalName(name),
        mimeType: mimeForExtension(extension),
        kind,
        size,
      },
      select: { id: true, url: true, originalName: true, mimeType: true, kind: true, size: true },
    });

    return NextResponse.json(
      { success: true, url: stored.url, kind, size, attachment },
      { status: 201 }
    );
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json({ success: false, error: t("uploadFailed") }, { status: 500 });
  }
}
