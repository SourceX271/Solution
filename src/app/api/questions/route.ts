import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getQuestionSchema } from "@/lib/validations";
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
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.question") }) },
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
    const parsed = getQuestionSchema(tv).safeParse(body);
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
    // Without this the ISR-cached list/homepage kept hiding the new question
    // for up to a minute even though the author was redirected to it.
    revalidateContentList("questions");

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: t("createFailed", { entity: t("entity.question") }) },
      { status: 500 }
    );
  }
}
