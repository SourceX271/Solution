import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatDate } from "@/lib/utils"
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
  const locale = await getLocale()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("siteSettingsTitle")}</h2>
          <p className="mt-1 text-muted-foreground">{t("siteSettingsDesc")}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("updatedAt")}: {formatDate(config.updatedAt, locale)}
        </p>
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
            config={{
              siteName: config.siteName,
              siteDescription: config.siteDescription,
              logo: config.logo,
              keywords: config.keywords,
              contactEmail: config.contactEmail,
              githubUrl: config.githubUrl,
              twitterUrl: config.twitterUrl,
              footerText: config.footerText,
              icpNumber: config.icpNumber,
              featuredArticle: config.featuredArticle,
              featuredQuestion: config.featuredQuestion,
              featuredSoftware: config.featuredSoftware,
              enableSolutions: config.enableSolutions,
              enableQuestions: config.enableQuestions,
              enableSoftware: config.enableSoftware,
            }}
            articles={articles}
            questions={questions}
            software={software}
          />
        </CardContent>
      </Card>
    </div>
  )
}
