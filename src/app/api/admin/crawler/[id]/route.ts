import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const crawlerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  category: z.string().max(50).optional(),
  enabled: z.boolean().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const parsed = crawlerUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  try {
    await prisma.crawlSource.update({ where: { id: params.id }, data: parsed.data })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}