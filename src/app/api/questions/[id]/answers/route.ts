import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAnswerSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { sanitizeHtml } from "@/lib/sanitize";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { readJson } from "@/lib/request";
import { revalidateContent } from "@/lib/revalidate";

export async function POST(
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

    const { allowed } = checkRateLimit(getRateLimitKey(req, "answer"), { windowMs: 60000, maxRequests: 10 });
    if (!allowed) {
      return NextResponse.json({ error: t("rateLimited") }, { status: 429 });
    }

    const question = await prisma.question.findUnique({ where: { id: params.id } });
    if (!question) {
      return NextResponse.json(
        { error: t("notFound", { entity: t("entity.question") }) },
        { status: 404 }
      );
    }

    const body = await readJson(req);
    const parsed = getAnswerSchema(tv).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const authorId = (session.user as any).id as string;
    // Answers are rendered as HTML, so store sanitised markup.
    const content = await sanitizeHtml(parsed.data.content);

    const answer = await prisma.$transaction(async (tx) => {
      const created = await tx.answer.create({
        data: {
          content,
          questionId: params.id,
          authorId,
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      await tx.question.update({
        where: { id: params.id },
        data: { answerCount: { increment: 1 } },
      });

      return created;
    });

    await createNotification({
      userId: question.authorId,
      actorId: authorId,
      type: "answer",
      messageKey: "newAnswer",
      messageParams: { name: session.user?.name || "Someone", title: question.title },
      link: `/questions/${question.slug}`,
    });

    revalidateContent("questions", question.slug);

    return NextResponse.json(answer, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: t("createFailed", { entity: t("entity.answer") }) },
      { status: 500 }
    );
  }
}
