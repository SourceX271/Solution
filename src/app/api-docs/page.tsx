import { Code2 } from "lucide-react"

const ENDPOINTS = [
  // Articles
  { method: "GET", path: "/api/articles", description: "获取文章列表（支持分页、分类筛选）" },
  { method: "GET", path: "/api/articles/[slug]", description: "获取单篇文章详情" },
  { method: "POST", path: "/api/articles", description: "创建新文章（需登录）" },
  { method: "PUT", path: "/api/articles/[id]", description: "更新文章（作者/管理员）" },
  { method: "DELETE", path: "/api/articles/[id]", description: "删除文章（作者/管理员）" },

  // Questions
  { method: "GET", path: "/api/questions", description: "获取问题列表（支持分页、状态筛选）" },
  { method: "GET", path: "/api/questions/[slug]", description: "获取单个问题详情" },
  { method: "POST", path: "/api/questions", description: "创建新问题（需登录）" },
  { method: "PUT", path: "/api/questions/[id]", description: "更新问题（作者/管理员）" },
  { method: "DELETE", path: "/api/questions/[id]", description: "删除问题（作者/管理员）" },

  // Answers
  { method: "GET", path: "/api/answers?questionId=:id", description: "获取问题的所有回答" },
  { method: "POST", path: "/api/answers", description: "提交回答（需登录）" },
  { method: "PUT", path: "/api/answers/[id]", description: "编辑回答（作者）" },
  { method: "PUT", path: "/api/answers/[id]/accept", description: "采纳回答（问题作者）" },
  { method: "DELETE", path: "/api/answers/[id]", description: "删除回答（作者/管理员）" },

  // Software
  { method: "GET", path: "/api/software", description: "获取软件列表（支持分页、分类筛选）" },
  { method: "GET", path: "/api/software/[slug]", description: "获取单个软件详情" },
  { method: "POST", path: "/api/software", description: "创建新软件条目（需登录）" },
  { method: "PUT", path: "/api/software/[id]", description: "更新软件条目（作者/管理员）" },
  { method: "DELETE", path: "/api/software/[id]", description: "删除软件条目（作者/管理员）" },

  // Comments
  { method: "GET", path: "/api/comments?targetType=:type&targetId=:id", description: "获取评论列表" },
  { method: "POST", path: "/api/comments", description: "发表评论（需登录）" },
  { method: "DELETE", path: "/api/comments/[id]", description: "删除评论（作者/管理员）" },

  // Votes
  { method: "POST", path: "/api/votes", description: "投票（需登录，body: targetType, targetId, value）" },

  // Bookmarks
  { method: "GET", path: "/api/bookmarks", description: "获取用户收藏列表（需登录）" },
  { method: "POST", path: "/api/bookmarks", description: "添加/取消收藏（需登录）" },

  // Users
  { method: "GET", path: "/api/users/profile", description: "获取当前用户个人资料（需登录）" },
  { method: "GET", path: "/api/users/[id]", description: "获取指定用户公开资料" },

  // Auth
  { method: "POST", path: "/api/auth/register", description: "用户注册" },
  { method: "POST", path: "/api/auth/callback/credentials", description: "邮箱密码登录" },

  // Search
  { method: "GET", path: "/api/search?q=:query", description: "全局搜索文章、问答、软件" },

  // Admin
  { method: "GET", path: "/api/admin/stats", description: "获取管理后台统计数据（管理员）" },
  { method: "GET", path: "/api/admin/content", description: "管理内容列表（管理员）" },
  { method: "GET", path: "/api/admin/users", description: "管理用户列表（管理员）" },

  // Crawler
  { method: "POST", path: "/api/crawler/run", description: "触发爬虫任务（管理员）" },
  { method: "GET", path: "/api/crawler/logs", description: "获取爬虫日志（管理员）" },
]

const methodColors: Record<string, string> = {
  GET: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

export default function ApiDocsPage() {
  // Group endpoints by category
  const sections = [
    { title: "文章 (Articles)", prefix: "/api/articles" },
    { title: "问答 (Questions)", prefix: "/api/questions" },
    { title: "回答 (Answers)", prefix: "/api/answers" },
    { title: "软件 (Software)", prefix: "/api/software" },
    { title: "评论 (Comments)", prefix: "/api/comments" },
    { title: "投票 (Votes)", prefix: "/api/votes" },
    { title: "收藏 (Bookmarks)", prefix: "/api/bookmarks" },
    { title: "用户 (Users)", prefix: "/api/users" },
    { title: "认证 (Auth)", prefix: "/api/auth" },
    { title: "搜索 (Search)", prefix: "/api/search" },
    { title: "管理 (Admin)", prefix: "/api/admin" },
    { title: "爬虫 (Crawler)", prefix: "/api/crawler" },
  ]

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Code2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">API 文档</h1>
        </div>
        <p className="text-muted-foreground">
          Solution 平台 RESTful API 接口文档。所有需要登录的接口需在请求头中携带有效的 Session Cookie。
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => {
          const sectionEndpoints = ENDPOINTS.filter((ep) =>
            ep.path.startsWith(section.prefix)
          )
          if (sectionEndpoints.length === 0) return null

          return (
            <section key={section.title}>
              <h2 className="mb-3 border-b pb-2 text-lg font-semibold">{section.title}</h2>
              <div className="space-y-1">
                {sectionEndpoints.map((ep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span
                      className={`inline-flex w-16 shrink-0 justify-center rounded px-2 py-0.5 text-xs font-mono font-medium ${methodColors[ep.method] ?? ""}`}
                    >
                      {ep.method}
                    </span>
                    <code className="shrink-0 text-sm font-mono text-foreground">
                      {ep.path}
                    </code>
                    <span className="min-w-0 text-muted-foreground">
                      {ep.description}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-12 rounded-lg border p-6">
        <h2 className="mb-3 text-lg font-semibold">通用说明</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• 基础 URL: <code className="rounded bg-muted px-1 py-0.5 text-xs">/api</code></li>
          <li>• 请求/响应格式: JSON</li>
          <li>• 分页参数: <code className="rounded bg-muted px-1 py-0.5 text-xs">?page=1&limit=10</code></li>
          <li>• 认证方式: Session Cookie（通过 next-auth）</li>
          <li>• 管理接口需要用户角色为 ADMIN</li>
        </ul>
      </div>
    </div>
  )
}