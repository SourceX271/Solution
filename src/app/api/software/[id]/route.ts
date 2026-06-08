import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { softwareSchema } from "@/lib/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const software = await prisma.software.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true, image: true, bio: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { comments: true } },
      },
    });

    if (!software) {
      return NextResponse.json({ error: "软件条目不存在" }, { status: 404 });
    }

    return NextResponse.json(software);
  } catch (error) {
    return NextResponse.json({ error: "获取软件条目失败" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const software = await prisma.software.findUnique({ where: { id: params.id } });
    if (!software) {
      return NextResponse.json({ error: "软件条目不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (software.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权修改此软件条目" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = softwareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.software.update({
      where: { id: params.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        url: parsed.data.url || null,
        category: parsed.data.category,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "更新软件条目失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const software = await prisma.software.findUnique({ where: { id: params.id } });
    if (!software) {
      return NextResponse.json({ error: "软件条目不存在" }, { status: 404 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    if (software.authorId !== userId && userRole !== "ADMIN") {
      return NextResponse.json({ error: "无权删除此软件条目" }, { status: 403 });
    }

    await prisma.software.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "软件条目已删除" });
  } catch (error) {
    return NextResponse.json({ error: "删除软件条目失败" }, { status: 500 });
  }
}
