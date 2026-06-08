import { prisma } from "@/lib/db"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "联系我们" }

export default async function ContactPage() {
  const config = await prisma.siteConfig.findUnique({ where: { id: "main" } })
  const email = config?.contactEmail || "support@solution.com"
  const github = config?.githubUrl || ""
  const twitter = config?.twitterUrl || ""

  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-6 text-3xl font-bold">联系我们</h1>
      <div className="prose-custom">
        <p>欢迎通过以下方式与我们取得联系：</p>
        <ul>
          <li>邮箱：{email}</li>
          {github && <li>GitHub：<a href={github} target="_blank" rel="noopener noreferrer">{github}</a></li>}
          {twitter && <li>Twitter：<a href={twitter} target="_blank" rel="noopener noreferrer">{twitter}</a></li>}
        </ul>
        <h2>反馈建议</h2>
        <p>我们非常重视您的反馈。如有任何建议或问题，请随时通过以上方式联系我们。</p>
      </div>
    </div>
  )
}