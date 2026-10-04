import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiT } from "@/lib/api-i18n";

export async function GET() {
  const t = await getApiT("api");
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: t("forbiddenAccess") }, { status: 403 });
    }

    const [users, articles, questions, software, answers] = await Promise.all([
      prisma.user.count(),
      prisma.article.count(),
      prisma.question.count(),
      prisma.software.count(),
      prisma.answer.count(),
    ]);

    return NextResponse.json({ users, articles, questions, software, answers });
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.stats") }) },
      { status: 500 }
    );
  }
}
