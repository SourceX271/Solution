import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { questionSchema } from "@/lib/validations";
import { generateSlug } from "@/lib/utils";
import { resolveTags, parseTagInput, bumpTagUsage } from "@/lib/tags";
import { toPositiveInt } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = toPositiveInt(searchParams.get("page"), 1);
    const limit = toPositiveInt(searchParams.get("limit"), 10, 100);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }
    if (tag) {
      where.tags = { some: { slug: tag } };
    }

    const [data, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, image: true } },
          _count: { select: { comments: true, answers: true } },
        },
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    return NextResponse.json({ error: "获取问题列表失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { title, content, tags } = parsed.data;
    const slug = generateSlug();

    const tagConnections = await resolveTags(parseTagInput(tags));
    const question = await prisma.question.create({
      data: {
        tags: {
          connectOrCreate: tagConnections.map((t) => ({
            where: { slug: t.slug },
            create: { name: t.name, slug: t.slug },
          })),
        },
        title,
        slug,
        content,
        authorId: (session.user as any).id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    await bumpTagUsage(tagConnections.map((t) => t.slug), 1);

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建问题失败" }, { status: 500 });
  }
}
