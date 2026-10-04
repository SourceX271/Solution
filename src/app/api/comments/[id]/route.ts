import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCommentSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";

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

    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.comment") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (comment.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.comment") }) },
        { status: 403 }
      );
    }

    const body = await req.json();
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
  { params }: { params: { id: string } }
) {
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
    const userRole = (session.user as any).role;
    if (comment.authorId !== userId && userRole !== "ADMIN") {
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

    return NextResponse.json({ message: t("deleted", { entity: t("entity.comment") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.comment") }) },
      { status: 500 }
    );
  }
}
