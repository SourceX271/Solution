import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) {
      return NextResponse.json({ error: "评论不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (comment.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权删除此评论" }, { status: 403 });
    }

    await prisma.comment.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "评论已删除" });
  } catch (error) {
    return NextResponse.json({ error: "删除评论失败" }, { status: 500 });
  }
}
