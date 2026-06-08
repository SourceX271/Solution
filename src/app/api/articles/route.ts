import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { articleSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "published";
    const search = searchParams.get("search");
    const skip = (page - 1) * limit;

    const where: any = { status };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, image: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.article.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: "获取文章列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = articleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { title, content, excerpt, category, tags, status } = parsed.data;
    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now().toString(36);

    const tagSlugs = body.tags ? (Array.isArray(body.tags) ? body.tags : JSON.parse(body.tags || "[]")) : [];
    const article = await prisma.article.create({
      data: {
        tags: { connect: tagSlugs.map((s: string) => ({ slug: s })) },
        title,
        slug,
        content,
        excerpt,
        category,
        status: status || "published",
        authorId: (session.user as any).id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建文章失败" }, { status: 500 });
  }
}
