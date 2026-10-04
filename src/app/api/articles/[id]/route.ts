import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getArticleSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { bumpTagUsage } from "@/lib/tags";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true, image: true, bio: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { comments: true } },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.article") }) },
        { status: 404 }
      );
    }

    await prisma.article.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json(article);
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.article") }) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  const tv = await getApiT("validation");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const article = await prisma.article.findUnique({ where: { id: params.id } });
    if (!article) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.article") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (article.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.article") }) },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = getArticleSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        excerpt: parsed.data.excerpt,
        problem: parsed.data.problem,
        category: parsed.data.category,
        status: parsed.data.status,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.article") }) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: { tags: { select: { slug: true } } },
    });
    if (!article) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.article") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (article.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionDelete", { entity: t("entity.article") }) },
        { status: 403 }
      );
    }

    await prisma.article.delete({ where: { id: params.id } });
    await bumpTagUsage(article.tags.map((t) => t.slug), -1);

    return NextResponse.json({ message: t("deleted", { entity: t("entity.article") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.article") }) },
      { status: 500 }
    );
  }
}
