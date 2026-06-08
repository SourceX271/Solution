import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await req.json();
    const { targetType, targetId, value } = body as { targetType: string; targetId: string; value: number };

    if (!targetType || !targetId) {
      return NextResponse.json({ error: "缺少目标类型或ID" }, { status: 400 });
    }
    if (value !== 1 && value !== -1) {
      return NextResponse.json({ error: "投票值必须为1或-1" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    const existing = await prisma.vote.findUnique({
      where: {
        userId_targetType_targetId: { userId, targetType, targetId },
      },
    });

    if (existing) {
      if (existing.value === value) {
        // Toggle off
        await prisma.vote.delete({ where: { id: existing.id } });
        return NextResponse.json({ voted: false, message: "已取消投票" });
      } else {
        // Update value
        const updated = await prisma.vote.update({
          where: { id: existing.id },
          data: { value },
        });
        return NextResponse.json({ voted: true, vote: updated, message: "已更新投票" });
      }
    } else {
      // Create
      const vote = await prisma.vote.create({
        data: { userId, targetType, targetId, value },
      });
      return NextResponse.json({ voted: true, vote, message: "投票成功" }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ error: "投票操作失败" }, { status: 500 });
  }
}
