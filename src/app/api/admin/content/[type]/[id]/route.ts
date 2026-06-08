import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function DELETE(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, id } = params

  try {
    switch (type) {
      case "articles":
        await prisma.article.delete({ where: { id } })
        break
      case "questions":
        await prisma.question.delete({ where: { id } })
        break
      case "software":
        await prisma.software.delete({ where: { id } })
        break
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, id } = params
  const body = await req.json()

  try {
    switch (type) {
      case "articles":
        await prisma.article.update({ where: { id }, data: body })
        break
      case "questions":
        await prisma.question.update({ where: { id }, data: body })
        break
      case "software":
        await prisma.software.update({ where: { id }, data: body })
        break
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}