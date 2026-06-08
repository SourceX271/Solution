import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = params
  const body = await req.json()

  try {
    await prisma.user.update({ where: { id }, data: body })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}