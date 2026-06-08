import { prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, HelpCircle, Package } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const [userCount, articleCount, questionCount, softwareCount] = await Promise.all([
    prisma.user.count(),
    prisma.article.count(),
    prisma.question.count(),
    prisma.software.count(),
  ])

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, email: true, createdAt: true },
  })

  const recentArticles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, status: true, createdAt: true, author: { select: { name: true } } },
  })

  const recentQuestions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, status: true, createdAt: true, author: { select: { name: true } } },
  })

  const stats = [
    { label: "Total Users", value: userCount, icon: Users, color: "text-blue-600" },
    { label: "Articles", value: articleCount, icon: FileText, color: "text-green-600" },
    { label: "Questions", value: questionCount, icon: HelpCircle, color: "text-orange-600" },
    { label: "Software", value: softwareCount, icon: Package, color: "text-purple-600" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your platform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentUsers.map((user) => (
                  <li key={user.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{user.name || "Unnamed"}</p>
                      <p className="text-muted-foreground">{user.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Articles</CardTitle>
          </CardHeader>
          <CardContent>
            {recentArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No articles yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentArticles.map((article) => (
                  <li key={article.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium truncate max-w-[240px]">{article.title}</p>
                      <p className="text-muted-foreground">by {article.author.name || "Unknown"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(article.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Questions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Recent Questions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentQuestions.map((q) => (
                  <li key={q.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium truncate max-w-[400px]">{q.title}</p>
                      <p className="text-muted-foreground">by {q.author.name || "Unknown"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}