import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";
import { generateSlug } from "@/lib/utils";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20)
  );

  // Powers the tag picker's typeahead: search by name or slug, hottest first.
  const tags = await prisma.tag.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }] } : {},
    orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    take: limit,
    select: { id: true, name: true, slug: true, color: true, usageCount: true },
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const { allowed } = checkRateLimit(getRateLimitKey(req, "tag"), { windowMs: 60000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ error: t("rateLimitedShort") }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: t("requestFormatError") }, { status: 400 });
    }

    const { name, slug, color, description } = body as Record<string, unknown>;

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: t("tagNameRequired") }, { status: 400 });
    }
    if (name.trim().length > 30) {
      return NextResponse.json({ error: t("tagNameTooLong") }, { status: 400 });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > 200)) {
      return NextResponse.json({ error: t("tagDescTooLong") }, { status: 400 });
    }
    if (color !== undefined && (typeof color !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(color))) {
      return NextResponse.json({ error: t("tagColorInvalid") }, { status: 400 });
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
      return NextResponse.json({ error: t("tagExists") }, { status: 409 });
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
    return NextResponse.json(
      { error: t("createFailed", { entity: t("entity.tag") }) },
      { status: 500 }
    );
  }
}
