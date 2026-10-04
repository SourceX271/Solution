import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getQuestionSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { bumpTagUsage } from "@/lib/tags";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  try {
    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true, image: true, bio: true } },
        tags: { select: { name: true, slug: true, color: true } },
        answers: {
          where: { accepted: true },
          include: {
            author: { select: { id: true, name: true, image: true } },
            _count: { select: { comments: true } },
          },
          orderBy: [{ accepted: "desc" }, { voteCount: "desc" }],
        },
        _count: { select: { comments: true, answers: true } },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.question") }) },
        { status: 404 }
      );
    }

    await prisma.question.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json(question);
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.question") }) },
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

    const question = await prisma.question.findUnique({ where: { id: params.id } });
    if (!question) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.question") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (question.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.question") }) },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = getQuestionSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.question.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.question") }) },
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

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { tags: { select: { slug: true } } },
    });
    if (!question) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.question") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (question.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionDelete", { entity: t("entity.question") }) },
        { status: 403 }
      );
    }

    await prisma.question.delete({ where: { id: params.id } });
    await bumpTagUsage(question.tags.map((t) => t.slug), -1);

    return NextResponse.json({ message: t("deleted", { entity: t("entity.question") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.question") }) },
      { status: 500 }
    );
  }
}
