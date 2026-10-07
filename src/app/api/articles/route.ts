import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getArticleSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { generateSlug } from "@/lib/utils";
import { resolveTags, parseTagInput, bumpTagUsage } from "@/lib/tags";
import { revalidateContentList } from "@/lib/revalidate";
import { toPositiveInt } from "@/lib/errors";
import { readJson } from "@/lib/request";

export async function GET(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const { searchParams } = new URL(req.url);
    const page = toPositiveInt(searchParams.get("page"), 1);
    const limit = toPositiveInt(searchParams.get("limit"), 10, 100);
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
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.article") }) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  const tv = await getApiT("validation");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const body = await readJson(req);
    const parsed = getArticleSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { title, content, excerpt, problem, category, tags, status } = parsed.data;
    const slug = generateSlug();

    const tagConnections = await resolveTags(parseTagInput(tags));
    const article = await prisma.article.create({
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
        excerpt,
        problem,
        category,
        status: status || "published",
        authorId: (session.user as any).id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    await bumpTagUsage(tagConnections.map((t) => t.slug), 1);
    // Without this the ISR-cached list/homepage kept hiding the new solution for
    // up to a minute even though the author was redirected to it.
    revalidateContentList("articles");

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: t("createFailed", { entity: t("entity.article") }) },
      { status: 500 }
    );
  }
}
