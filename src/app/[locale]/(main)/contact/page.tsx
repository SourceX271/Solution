import { prisma } from "@/lib/db"
import type { Metadata } from "next"
import { Mail } from "lucide-react"

export const metadata: Metadata = { title: "联系我们" }

export default async function ContactPage() {
  const config = await prisma.siteConfig.findUnique({ where: { id: "main" } })
  const email = config?.contactEmail || ""

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">联系我们</h1>
      <div className="prose-custom max-w-none">
        <p>如果你有任何问题、建议或合作意向，欢迎通过以下方式联系我们。</p>
      </div>
      {email ? (
        <div className="mt-6 glass-card p-6 inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">邮箱</p>
            <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">{email}</a>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground">暂无联系方式</p>
      )}
    </div>
  )
}
