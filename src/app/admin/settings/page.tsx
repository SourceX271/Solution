import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"
import { SettingsForm } from "./SettingsForm"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  let config = await prisma.siteConfig.findUnique({ where: { id: "main" } })

  if (!config) {
    config = await prisma.siteConfig.create({ data: { id: "main" } })
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">网站设置</h2>
        <p className="text-muted-foreground">管理站点名称、描述、社交媒体链接和功能开关</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Settings className="h-5 w-5" />
          <div>
            <CardTitle className="text-lg">站点配置</CardTitle>
            <CardDescription>管理网站基本信息和功能</CardDescription>
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