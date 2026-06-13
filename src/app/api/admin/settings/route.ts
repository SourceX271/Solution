import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"

const settingsSchema = z.object({
  siteName: z.string().max(100).optional(),
  siteDescription: z.string().max(500).optional(),
  logo: z.string().max(500).optional(),
  keywords: z.string().max(500).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  githubUrl: z.string().max(500).optional(),
  twitterUrl: z.string().max(500).optional(),
  footerText: z.string().max(500).optional(),
  icpNumber: z.string().max(100).optional(),
  enableSolutions: z.boolean().optional(),
  enableQuestions: z.boolean().optional(),
  enableSoftware: z.boolean().optional(),
  featuredArticle: z.string().optional(),
  featuredQuestion: z.string().optional(),
  featuredSoftware: z.string().optional(),
})

export async function PUT(req: Request) {
  const session = await auth()
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const body = await req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }
  try {
    const config = await prisma.siteConfig.upsert({
      where: { id: "main" },
      update: parsed.data,
      create: { id: "main", ...parsed.data },
    })
    return NextResponse.json(config)
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
