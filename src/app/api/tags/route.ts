import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { usageCount: "desc" },
    take: 50,
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug, color, description } = body;
  if (!name) return NextResponse.json({ error: "标签名不能为空" }, { status: 400 });

  // 只接受纯 ASCII slug；否则（中文名 / 未提供 slug）生成随机 id，保证 URL 无中文
  const isAsciiSlug = (s: string) => /^[a-z0-9][a-z0-9-]*$/.test(s);
  const s = slug && isAsciiSlug(slug)
    ? slug
    : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || generateSlug();

  const tag = await prisma.tag.create({ data: { name, slug: s, color: color || "#6366f1", description } });
  return NextResponse.json(tag, { status: 201 });
}
