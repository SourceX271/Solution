import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    take: 50,
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "tag"), { windowMs: 60000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ error: "操作过于频繁" }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    const { name, slug, color, description } = body as Record<string, unknown>;

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "标签名不能为空" }, { status: 400 });
    }
    if (name.trim().length > 30) {
      return NextResponse.json({ error: "标签名最多30个字符" }, { status: 400 });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 200)) {
      return NextResponse.json({ error: "标签描述最多200个字符" }, { status: 400 });
    }
    if (color !== undefined && (typeof color !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(color))) {
      return NextResponse.json({ error: "标签颜色格式无效" }, { status: 400 });
    }

    const tagName = name.trim();

    // 只接受纯 ASCII slug；否则（中文名 / 未提供 slug）生成随机 id，保证 URL 无中文
    const isAsciiSlug = (s: string) => /^[a-z0-9][a-z0-9-]*$/.test(s);
    const s =
      typeof slug === "string" && isAsciiSlug(slug)
        ? slug
        : tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || generateSlug();

    const existing = await prisma.tag.findFirst({
      where: { OR: [{ name: tagName }, { slug: s }] },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json({ error: "标签已存在" }, { status: 409 });
    }

    const tag = await prisma.tag.create({
      data: {
        name: tagName,
        slug: s,
        color: typeof color === "string" ? color : "#6366f1",
        description: typeof description === "string" ? description : undefined,
      },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("Failed to create tag:", error);
    return NextResponse.json({ error: "创建标签失败" }, { status: 500 });
  }
}
