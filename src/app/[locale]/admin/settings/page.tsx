import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { SettingsForm } from "./SettingsForm"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  // A GET must not create rows; upsert also removes the concurrent-first-hit
  // race that made two simultaneous visits throw P2002.
  const config = await prisma.siteConfig.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  })

  const [articles, questions, software] = await Promise.all([
    prisma.article.findMany({
      where: { status: "published" },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.question.findMany({
      where: { status: "open" },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.software.findMany({
      where: { status: "published" },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  const t = await getTranslations("admin")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("siteSettingsTitle")}</h2>
        <p className="text-muted-foreground">{t("siteSettingsDesc")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Settings className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">{t("siteConfig")}</CardTitle>
            <CardDescription>{t("siteConfigDesc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <SettingsForm
            config={JSON.parse(JSON.stringify(config))}
            articles={JSON.parse(JSON.stringify(articles))}
            questions={JSON.parse(JSON.stringify(questions))}
            software={JSON.parse(JSON.stringify(software))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
