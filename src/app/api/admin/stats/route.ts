import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
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
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
