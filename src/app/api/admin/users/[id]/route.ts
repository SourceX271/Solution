import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const userUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
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

  const actorId = (session.user as any).id as string

  // Role is frozen in the JWT at sign-in, so re-check the caller's *current*
  // role from the database: a demoted admin must not be able to keep editing.
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  })
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (parsed.data.role === "USER") {
    if (id === actorId) {
      return NextResponse.json({ error: "不能撤销自己的管理员权限" }, { status: 400 })
    }
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: "至少需要保留一名管理员" }, { status: 400 })
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, role: true },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
