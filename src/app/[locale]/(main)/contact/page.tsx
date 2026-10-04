import { prisma } from "@/lib/db"
import type { Metadata } from "next"
import { Mail } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact")
  return { title: t("title") }
}

export default async function ContactPage() {
  const t = await getTranslations("contact")
  const config = await prisma.siteConfig.findUnique({ where: { id: "main" } })
  const email = config?.contactEmail || ""

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-6">{t("title")}</h1>
      <div className="prose-custom max-w-none">
        <p>{t("intro")}</p>
      </div>
      {email ? (
        <div className="mt-6 glass-card p-6 inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("email")}</p>
            <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">{email}</a>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("noContact")}</p>
      )}
    </div>
  )
}
