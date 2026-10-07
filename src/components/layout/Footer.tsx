import Link from "next/link"
import { prisma } from "@/lib/db"
import { Github, Twitter, Mail, Globe, Heart } from "lucide-react"
import { Logo } from "@/components/Logo"
import { getTranslations, getLocale } from "next-intl/server"

const footerLinks = [
  { href: "/about", key: "about" as const },
  { href: "/help", key: "help" as const },
  { href: "/privacy", key: "privacy" as const },
  { href: "/contact", key: "contact" as const },
]

export async function Footer() {
  const t = await getTranslations("footer")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const config = await prisma.siteConfig.findUnique({ where: { id: "main" } })
  const siteName = config?.siteName || "Solution"
  // The admin-entered description is a single (usually Chinese) value, so it is
  // only used for the default locale — other locales use the translated copy.
  const siteDescription =
    locale === "zh" && config?.siteDescription ? config.siteDescription : tc("siteDescription")
  const contactEmail = config?.contactEmail || ""
  const githubUrl = config?.githubUrl || ""
  const twitterUrl = config?.twitterUrl || ""
  const footerText = config?.footerText || ""
  const icpNumber = config?.icpNumber || ""
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
              <Logo className="h-9 w-9 transition-transform duration-300 group-hover:scale-105" />
              <span className="text-xl font-bold tracking-tight gradient-text">
                {siteName}
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              {siteDescription}
            </p>
            <div className="flex items-center gap-3 mt-4">
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm hover:shadow-md"
                >
                  <Github className="h-4 w-4" />
                </a>
              )}
              {twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm hover:shadow-md"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shadow-sm hover:shadow-md"
                >
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4">{t("quickLinks")}</h4>
            <ul className="space-y-2.5">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold mb-4">{t("contactTitle")}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {contactEmail && <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{contactEmail}</li>}
              {githubUrl && (
                <li>
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors">
                    <Github className="h-3.5 w-3.5" />GitHub
                  </a>
                </li>
              )}
              {twitterUrl && (
                <li>
                  <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors">
                    <Twitter className="h-3.5 w-3.5" />Twitter
                  </a>
                </li>
              )}
              {!contactEmail && !githubUrl && !twitterUrl && (
                <li>{t("noContact")}</li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-1">
            {footerText ? footerText : (
              <>{"\u00A9"} {currentYear} {siteName}. {t("allRights")}</>
            )}
          </p>
          <div className="flex items-center gap-4">
            {icpNumber && <p>{icpNumber}</p>}
            <p className="flex items-center gap-1 text-xs">
              <Heart className="h-3 w-3 text-red-500 fill-red-500" aria-hidden="true" />
              {tc("madeWith")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
