import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { logAdminAction } from "@/lib/audit";
import { revalidateContent } from "@/lib/revalidate";

/**
 * Moderation delete. Replies keep existing (Comment.parentId is `SetNull`), so
 * the thread stays readable instead of disappearing with the removed parent.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = params;
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      authorId: true,
      articleId: true,
      questionId: true,
      answerId: true,
      softwareId: true,
      article: { select: { slug: true } },
      question: { select: { slug: true } },
      software: { select: { slug: true } },
      _count: { select: { replies: true } },
    },
  });

  if (!comment) {
    return NextResponse.json({ error: t("notFound", { entity: t("entity.comment") }) }, { status: 404 });
  }

  try {
    await prisma.comment.delete({ where: { id } });

    await logAdminAction({
      actor: guard.user,
      action: "comment.delete",
      targetType: "comment",
      targetId: id,
      targetLabel: comment.content.slice(0, 120),
      metadata: {
        authorId: comment.authorId,
        replies: comment._count.replies,
        target: comment.articleId ?? comment.questionId ?? comment.answerId ?? comment.softwareId,
      },
      req,
    });

    if (comment.articleId) revalidateContent("articles", comment.article?.slug);
    else if (comment.questionId) revalidateContent("questions", comment.question?.slug);
    else if (comment.softwareId) revalidateContent("software", comment.software?.slug);
    else if (comment.answerId) revalidateContent("questions");

    return NextResponse.json({ success: true, repliesKept: comment._count.replies });
  } catch (error) {
    console.error("Admin comment delete failed", error);
    return NextResponse.json({ error: t("deleteFailed", { entity: t("entity.comment") }) }, { status: 500 });
  }
}
