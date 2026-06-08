import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  try {
    const config = await prisma.siteConfig.upsert({
      where: { id: "main" },
      update: body,
      create: { id: "main", ...body },
    })
    return NextResponse.json(config)
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}