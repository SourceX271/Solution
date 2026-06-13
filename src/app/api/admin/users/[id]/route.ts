import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const userUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN", "AUTHOR", "MODERATOR"]).optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()
  const parsed = userUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 })
  }

  try {
    await prisma.user.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
