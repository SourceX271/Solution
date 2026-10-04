import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { z } from "zod";

const viewSchema = z.object({
  targetType: z.enum(["article", "question"]),
  targetId: z.string().min(1),
});

// Client-side view tracking. Kept intentionally simple and cheap:
// no auth required (a bot could inflate counts, but the count is cosmetic).
// Uses a quick update to avoid blocking page render on the server.
export async function POST(req: NextRequest) {
  const t = await getApiT("api");
  try {
    const body = await req.json();
    const parsed = viewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: t("invalidParams") }, { status: 400 });
    }

    const { targetType, targetId } = parsed.data;

    if (targetType === "article") {
      const exists = await prisma.article.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!exists)
        return NextResponse.json({ error: t("contentNotFound") }, { status: 404 });
      await prisma.article.update({
        where: { id: targetId },
        data: { viewCount: { increment: 1 } },
      });
    } else {
      const exists = await prisma.question.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!exists)
        return NextResponse.json({ error: t("contentNotFound") }, { status: 404 });
      await prisma.question.update({
        where: { id: targetId },
        data: { viewCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: t("viewRecordFailed") }, { status: 500 });
  }
}
