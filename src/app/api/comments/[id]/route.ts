import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCommentSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { readJson } from "@/lib/request";
import { revalidateContentList } from "@/lib/revalidate";
import { getSessionUser, isActiveAdmin } from "@/lib/admin-guard";

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

    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.comment") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    if (comment.authorId !== userId && !isActiveAdmin(await getSessionUser())) {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.comment") }) },
        { status: 403 }
      );
    }

    const body = await readJson(req);
    const parsed = getCommentSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.comment.update({
      where: { id: params.id },
      data: { content: parsed.data.content },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.comment") }) },
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

    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.comment") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    if (comment.authorId !== userId && !isActiveAdmin(await getSessionUser())) {
      return NextResponse.json(
        { error: t("noPermissionDelete", { entity: t("entity.comment") }) },
        { status: 403 }
      );
    }

    // Clear parentId on child comments before deleting
    await prisma.comment.updateMany({
      where: { parentId: params.id },
      data: { parentId: null },
    });

    await prisma.comment.delete({ where: { id: params.id } });

    // The target's list page renders a comment count and is ISR-cached.
    revalidateContentList(
      comment.articleId ? "articles" : comment.softwareId ? "software" : "questions"
    );

    return NextResponse.json({ message: t("deleted", { entity: t("entity.comment") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.comment") }) },
      { status: 500 }
    );
  }
}
