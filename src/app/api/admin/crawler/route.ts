import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const crawlerSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  category: z.string().max(50).default("tech"),
  enabled: z.boolean().default(true),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const body = await req.json()
  const parsed = crawlerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  try {
    const source = await prisma.crawlSource.create({ data: parsed.data })
    return NextResponse.json(source)
  } catch {
    return NextResponse.json({ error: "Create failed" }, { status: 500 })
  }
}
