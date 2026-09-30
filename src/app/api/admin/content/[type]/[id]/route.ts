import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveTags } from "@/lib/tags"
import { bumpTagUsage } from "@/lib/tags"

const contentUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  content: z.string().optional(),
  // The admin edit form sends `null` to clear a field; zod `.optional()` alone
  // rejects null and made every save with an empty excerpt/url fail with 400.
  excerpt: z.string().max(500).nullable().optional(),
  problem: z.string().max(2000).nullable().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  name: z.string().max(100).optional(),
  description: z.string().optional(),
  url: z.string().max(500).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  image: z.string().max(500).nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
})

type ContentType = "articles" | "questions" | "software"

const ALLOWED_FIELDS: Record<ContentType, string[]> = {
  articles: ["title", "content", "excerpt", "problem", "category", "status", "coverImage"],
  questions: ["title", "content", "status"],
  software: ["name", "description", "url", "category", "status", "image"],
}

const MODEL_BY_TYPE = {
  articles: prisma.article,
  questions: prisma.question,
  software: prisma.software,
} as const

/** Remove polymorphic Vote/Bookmark rows that point at deleted content. */
async function purgeOrphans(targetType: string, targetId: string) {
  await Promise.all([
    prisma.vote.deleteMany({ where: { targetType, targetId } }),
    prisma.bookmark.deleteMany({ where: { targetType, targetId } }),
  ])
}

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
      case "articles": {
        const article = await prisma.article.findUnique({
          where: { id },
          include: { tags: { select: { slug: true } } },
        })
        await prisma.article.delete({ where: { id } })
        await purgeOrphans("article", id)
        if (article) await bumpTagUsage(article.tags.map((t) => t.slug), -1)
        break
      }
      case "questions": {
        const question = await prisma.question.findUnique({
          where: { id },
          include: { tags: { select: { slug: true } } },
        })
        await prisma.question.delete({ where: { id } })
        await purgeOrphans("question", id)
        if (question) await bumpTagUsage(question.tags.map((t) => t.slug), -1)
        break
      }
      case "software":
        await prisma.software.delete({ where: { id } })
        await purgeOrphans("software", id)
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
    return NextResponse.json(
      { error: `Invalid fields: ${parsed.error.errors.map((e) => e.path.join(".")).join(", ")}` },
      { status: 400 }
    )
  }

  const keys = ALLOWED_FIELDS[type as ContentType]
  if (!keys) return NextResponse.json({ error: "Invalid type" }, { status: 400 })

  const data: Record<string, unknown> = {}
  for (const key of keys) {
    const value = parsed.data[key as keyof typeof parsed.data]
    if (value !== undefined) {
      data[key] = value
    }
  }

  // Tags are a relation, not a column: accept both ["a","b"] and "a, b".
  let tagUpdate: { set: { slug: string }[]; connectOrCreate: { where: { slug: string }; create: { name: string; slug: string } }[] } | undefined
  if (type !== "software" && parsed.data.tags !== undefined) {
    const raw = parsed.data.tags
    const names = (Array.isArray(raw) ? raw : String(raw).split(","))
      .map((t) => t.trim())
      .filter(Boolean)
    const resolved = await resolveTags(names)
    tagUpdate = {
      set: [],
      connectOrCreate: resolved.map((t) => ({
        where: { slug: t.slug },
        create: { name: t.name, slug: t.slug },
      })),
    }
  }

  try {
    const model = MODEL_BY_TYPE[type as ContentType]
    await (model as any).update({
      where: { id },
      data: tagUpdate ? { ...data, tags: tagUpdate } : data,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
