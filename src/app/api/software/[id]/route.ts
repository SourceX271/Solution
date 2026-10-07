import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getSoftwareSchema } from "@/lib/validations";
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
    const software = await prisma.software.findUnique({
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

    if (!software) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.software") }) },
        { status: 404 }
      );
    }

    return NextResponse.json(software);
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.software") }) },
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

    const software = await prisma.software.findUnique({
      where: { id: params.id },
      include: { tags: { select: { slug: true } } },
    });
    if (!software) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.software") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    if (software.authorId !== userId && !isActiveAdmin(await getSessionUser())) {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.software") }) },
        { status: 403 }
      );
    }

    const body = await readJson(req);
    const parsed = getSoftwareSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const tagUpdate = await buildTagUpdate(parsed.data.tags);

    const updated = await prisma.software.update({
      where: { id: params.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        url: parsed.data.url || null,
        category: parsed.data.category,
        ...(tagUpdate ? { tags: tagUpdate.data } : {}),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        tags: { select: { name: true, slug: true, color: true } },
      },
    });

    if (tagUpdate) {
      await syncTagUsage(software.tags.map((tag) => tag.slug), tagUpdate.slugs);
    }
    revalidateContent("software", software.slug);

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.software") }) },
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

    const software = await prisma.software.findUnique({
      where: { id: params.id },
      include: { tags: { select: { slug: true } } },
    });
    if (!software) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.software") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    if (software.authorId !== userId && !isActiveAdmin(await getSessionUser())) {
      return NextResponse.json(
        { error: t("noPermissionDelete", { entity: t("entity.software") }) },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Polymorphic votes/bookmarks have no foreign key, so they must go first.
      await purgeContentRelations(tx, "software", params.id);
      await tx.software.delete({ where: { id: params.id } });
    });
    await bumpTagUsage(software.tags.map((t) => t.slug), -1);
    revalidateContentList("software");

    return NextResponse.json({ message: t("deleted", { entity: t("entity.software") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.software") }) },
      { status: 500 }
    );
  }
}
