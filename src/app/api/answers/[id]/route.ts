import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAnswerSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { sanitizeHtml } from "@/lib/sanitize";
import { createNotification } from "@/lib/notifications";

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

    const answer = await prisma.answer.findUnique({ where: { id: params.id } });
    if (!answer) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.answer") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (answer.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionEdit", { entity: t("entity.answer") }) },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = getAnswerSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.answer.update({
      where: { id: params.id },
      data: { content: await sanitizeHtml(parsed.data.content) },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.answer") }) },
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

    const answer = await prisma.answer.findUnique({ where: { id: params.id } });
    if (!answer) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.answer") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (answer.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: t("noPermissionDelete", { entity: t("entity.answer") }) },
        { status: 403 }
      );
    }

    // Keep the denormalised counters and the question status consistent with
    // the deleted answer, in a single transaction.
    await prisma.$transaction(async (tx) => {
      await tx.answer.delete({ where: { id: params.id } });

      const question = await tx.question.findUnique({
        where: { id: answer.questionId },
        select: { answerCount: true, status: true },
      });

      await tx.question.update({
        where: { id: answer.questionId },
        data: {
          answerCount: Math.max(0, (question?.answerCount ?? 1) - 1),
          // Deleting the accepted answer reopens the question.
          ...(answer.accepted && question?.status === "solved" ? { status: "open" } : {}),
        },
      });
    });

    return NextResponse.json({ message: t("deleted", { entity: t("entity.answer") }) });
  } catch (error) {
    return NextResponse.json(
      { error: t("deleteFailed", { entity: t("entity.answer") }) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: t("unauthorized") }, { status: 401 });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: params.id },
      include: { question: { select: { id: true, authorId: true, title: true, slug: true } } },
    });
    if (!answer) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.answer") }) },
        { status: 404 }
      );
    }

    const userId = (session.user as any).id;
    if (answer.question.authorId !== userId) {
      return NextResponse.json({ error: t("onlyAskerCanAccept") }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.answer.updateMany({
        where: { questionId: answer.questionId },
        data: { accepted: false },
      });

      const accepted = await tx.answer.update({
        where: { id: params.id },
        data: { accepted: true },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      // Accepting an answer marks the question as solved — without this the
      // "已解决" badge and the solved filter could never light up.
      await tx.question.update({
        where: { id: answer.questionId },
        data: { status: "solved" },
      });

      return accepted;
    });

    await createNotification({
      userId: answer.authorId,
      actorId: userId,
      type: "accepted",
      messageKey: "answerAccepted",
      messageParams: { name: session.user?.name || "Someone", title: answer.question.title },
      link: `/questions/${answer.question.slug}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: t("acceptFailed") },
      { status: 500 }
    );
  }
}
