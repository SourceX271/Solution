import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  try {
    const source = await prisma.crawlSource.create({ data: body })
    return NextResponse.json(source)
  } catch {
    return NextResponse.json({ error: "Create failed" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  try {
    await prisma.crawlSource.update({ where: { id: params.id }, data: body })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}