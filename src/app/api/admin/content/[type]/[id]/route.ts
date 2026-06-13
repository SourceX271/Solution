import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const contentUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  content: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  problem: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  url: z.string().optional(),
})

export async function DELETE(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
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
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { type, id } = params
  const body = await req.json()
  const parsed = contentUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 })
  }

  const allowedFields: Record<string, string[]> = {
    articles: ["title", "content", "excerpt", "problem", "category", "status"],
    questions: ["title", "content", "status"],
    software: ["name", "description", "url", "category", "status"],
  }

  const keys = allowedFields[type]
  if (!keys) return NextResponse.json({ error: "Invalid type" }, { status: 400 })

  const data: Record<string, unknown> = {}
  for (const key of keys) {
    if (parsed.data[key as keyof typeof parsed.data] !== undefined) {
      data[key] = parsed.data[key as keyof typeof parsed.data]
    }
  }

  try {
    switch (type) {
      case "articles":
        await prisma.article.update({ where: { id }, data })
        break
      case "questions":
        await prisma.question.update({ where: { id }, data })
        break
      case "software":
        await prisma.software.update({ where: { id }, data })
        break
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
