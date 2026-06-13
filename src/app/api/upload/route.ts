import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "upload"), { windowMs: 60000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ success: false, error: "上传过于频繁，请稍后再试" }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "未选择文件" }, { status: 400 });
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ success: false, error: "不支持的文件格式" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "文件不能超过 2MB" }, { status: 400 });
    }

    // Whitelist extension derived from MIME type, not user-supplied filename
    const ext = file.type.split("/").pop() || "jpg";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ success: false, error: "不允许的文件扩展名" }, { status: 400 });
    }

    // Sanitize: use only UUID, no user-controlled path segment
    const filename = randomUUID() + "." + ext;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    const url = "/uploads/avatars/" + filename;
    return NextResponse.json({ success: true, url });
  } catch {
    return NextResponse.json({ success: false, error: "上传失败" }, { status: 500 });
  }
}
