import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { EditContentForm } from "./EditContentForm"

export const dynamic = "force-dynamic"

type ContentType = "articles" | "questions" | "software"

const typeMap: Record<ContentType, { model: string; titleField: string }> = {
  articles: { model: "article", titleField: "title" },
  questions: { model: "question", titleField: "title" },
  software: { model: "software", titleField: "name" },
}

async function getItem(type: ContentType, id: string) {
  if (type === "articles") {
    return prisma.article.findUnique({ where: { id }, include: { author: { select: { name: true } } } })
  } else if (type === "questions") {
    return prisma.question.findUnique({ where: { id }, include: { author: { select: { name: true } } } })
  } else if (type === "software") {
    return prisma.software.findUnique({ where: { id }, include: { author: { select: { name: true } } } })
  }
  return null
}

export default async function EditContentPage({
  params,
}: {
  params: { type: string; id: string }
}) {
  const type = params.type as ContentType

  if (!["articles", "questions", "software"].includes(type)) {
    notFound()
  }

  const item = await getItem(type, params.id)
  if (!item) notFound()

  const meta = typeMap[type]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Edit {type.slice(0, -1).charAt(0).toUpperCase() + type.slice(0, -1).slice(1)}
        </h2>
        <p className="text-muted-foreground">
          Editing: {(item as any)[meta.titleField]}
        </p>
      </div>

      <EditContentForm type={type} item={JSON.parse(JSON.stringify(item))} />
    </div>
  )
}