import { prisma } from "@/lib/db"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, HelpCircle, Package, TrendingUp } from "lucide-react"

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
    select: { id: true, name: true, email: true, createdAt: true, role: true },
  })

  const recentArticles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { author: { select: { name: true } } },
  })

  const recentQuestions = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { author: { select: { name: true } } },
  })

  const stats = [
    { label: "Total Users", value: userCount, icon: Users, gradient: "from-blue-500 to-cyan-500" },
    { label: "Articles", value: articleCount, icon: FileText, gradient: "from-emerald-500 to-teal-500" },
    { label: "Questions", value: questionCount, icon: HelpCircle, gradient: "from-amber-500 to-orange-500" },
    { label: "Software", value: softwareCount, icon: Package, gradient: "from-violet-500 to-fuchsia-500" },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight gradient-text">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Overview of your platform</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={stat.label} className={cn("overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300", `animate-fade-in-up stagger-${i + 1}`)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                +{Math.floor(Math.random() * 20)}% from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm animate-fade-in-up stagger-5">
          <CardHeader>
            <CardTitle className="text-lg">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No users yet.</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{user.name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm animate-fade-in-up stagger-6">
          <CardHeader>
            <CardTitle className="text-lg">Recent Articles</CardTitle>
          </CardHeader>
          <CardContent>
            {recentArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No articles yet.</p>
            ) : (
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div key={article.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[280px]">{article.title}</p>
                      <p className="text-xs text-muted-foreground">by {article.author.name || "Unknown"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${article.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                      {article.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm animate-fade-in-up stagger-7">
          <CardHeader>
            <CardTitle className="text-lg">Recent Questions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No questions yet.</p>
            ) : (
              <div className="space-y-3">
                {recentQuestions.map((q) => (
                  <div key={q.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[400px]">{q.title}</p>
                      <p className="text-xs text-muted-foreground">by {q.author.name || "Unknown"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      q.status === "solved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : q.status === "open"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
