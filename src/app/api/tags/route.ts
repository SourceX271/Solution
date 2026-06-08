import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { usageCount: "desc" },
    take: 50,
  });
  return NextResponse.json(tags);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, slug, color, description } = body;
  if (!name) return NextResponse.json({ error: "标签名不能为空" }, { status: 400 });
  const s = slug || name.toLowerCase().replace(/\s+/g, "-");
  const tag = await prisma.tag.create({ data: { name, slug: s, color: color || "#6366f1", description } });
  return NextResponse.json(tag, { status: 201 });
}
