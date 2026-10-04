import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/** Magic-byte sniffing: the declared Content-Type is attacker controlled. */
function detectImageType(buffer: Buffer): "jpg" | "png" | "gif" | "webp" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "gif";
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: t("unauthorized") }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "upload"), { windowMs: 60000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, error: t("uploadTooFrequent") }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: t("uploadNoFile") }, { status: 400 });
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ success: false, error: t("uploadBadType") }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: t("uploadTooLarge") }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Trust the bytes, not the filename or the declared MIME type.
    const detected = detectImageType(buffer);
    if (!detected) {
      return NextResponse.json({ success: false, error: t("uploadBadContent") }, { status: 400 });
    }

    if (!ALLOWED_EXTENSIONS.has(detected)) {
      return NextResponse.json({ success: false, error: t("uploadBadExtension") }, { status: 400 });
    }

    // Sanitize: use only UUID, no user-controlled path segment
    const filename = randomUUID() + "." + detected;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = "/uploads/avatars/" + filename;
    return NextResponse.json({ success: true, url });
  } catch {
    return NextResponse.json({ success: false, error: t("uploadFailed") }, { status: 500 });
  }
}
