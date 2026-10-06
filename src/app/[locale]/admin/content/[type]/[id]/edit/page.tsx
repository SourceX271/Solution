import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { EditContentForm } from "./EditContentForm"

export const dynamic = "force-dynamic"

type ContentType = "articles" | "questions" | "software"

const typeMap: Record<ContentType, { titleField: string }> = {
  articles: { titleField: "title" },
  questions: { titleField: "title" },
  software: { titleField: "name" },
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
  params: paramsPromise,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const params = await paramsPromise
  const type = params.type as ContentType

  if (!["articles", "questions", "software"].includes(type)) {
    notFound()
  }

  const item = await getItem(type, params.id)
  if (!item) notFound()

  const t = await getTranslations("admin.contentUi")
  const meta = typeMap[type]
  const titles: Record<ContentType, string> = {
    articles: t("editArticle"),
    questions: t("editQuestion"),
    software: t("editSoftware"),
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{titles[type]}</h2>
        <p className="text-muted-foreground">
          {t("editing")}: {(item as Record<string, unknown>)[meta.titleField] as string}
        </p>
      </div>

      <EditContentForm type={type} item={JSON.parse(JSON.stringify(item))} />
    </div>
  )
}
