import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getArticleSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { bumpTagUsage, buildTagUpdate, syncTagUsage } from "@/lib/tags";
import { revalidateContent, revalidateContentList } from "@/lib/revalidate";
import { purgeContentRelations } from "@/lib/content-purge";
import { readJson } from "@/lib/request";
import { getSessionUser, isActiveAdmin } from "@/lib/admin-guard";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
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
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
  const t = await getApiT("api");
  const tv = await getApiT("validation");
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
    if (article.authorId !== userId && !isActiveAdmin(await getSessionUser())) {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.article") }) },
        { status: 403 }
      );
    }

    const body = await readJson(req);
    const parsed = getArticleSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    // Tags are optional in the payload: omitted means "leave as-is", an
    // explicit empty list clears them (and rolls the counters back).
    const tagUpdate = await buildTagUpdate(parsed.data.tags);

    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        excerpt: parsed.data.excerpt,
        problem: parsed.data.problem,
        category: parsed.data.category,
        status: parsed.data.status,
        ...(tagUpdate ? { tags: tagUpdate.data } : {}),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    });

    if (tagUpdate) {
      await syncTagUsage(article.tags.map((tag) => tag.slug), tagUpdate.slugs);
    }
    // The detail/list pages are ISR-cached (up to 1h); make the edit visible now.
    revalidateContent("articles", article.slug);

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
  ctx: { params: Promise<{ id: string }> }
) {
  const params = await ctx.params;
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
    if (article.authorId !== userId && !isActiveAdmin(await getSessionUser())) {
      return NextResponse.json(
        { error: t("noPermissionDelete", { entity: t("entity.article") }) },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Polymorphic votes/bookmarks have no foreign key, so they must go first.
      await purgeContentRelations(tx, "article", params.id);
      await tx.article.delete({ where: { id: params.id } });
    });
    await bumpTagUsage(article.tags.map((t) => t.slug), -1);
    revalidateContentList("articles");

    return NextResponse.json({ message: t("deleted", { entity: t("entity.article") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.article") }) },
      { status: 500 }
    );
  }
}
