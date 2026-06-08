import Link from "next/link"
import { prisma } from "@/lib/db"

const footerLinks = [
  { href: "/about", label: "关于我们" },
  { href: "/help", label: "帮助中心" },
  { href: "/privacy", label: "隐私政策" },
  { href: "/contact", label: "联系我们" },
]

export async function Footer() {
  const config = await prisma.siteConfig.findUnique({ where: { id: "main" } })
  const siteName = config?.siteName || "Solution"
  const siteDescription = config?.siteDescription || "社区解决方案与问答平台"
  const contactEmail = config?.contactEmail || ""
  const githubUrl = config?.githubUrl || ""
  const twitterUrl = config?.twitterUrl || ""
  const footerText = config?.footerText || ""
  const icpNumber = config?.icpNumber || ""

  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto">
      <div className="glass border-t border-b-0 rounded-none">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Brand */}
            <div>
              <h3 className="text-lg font-bold">{siteName}</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs">{siteDescription}</p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold">快速链接</h4>
              <ul className="mt-3 space-y-2">
                {footerLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact & Social */}
            <div>
              <h4 className="text-sm font-semibold">联系方式</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {contactEmail && <li>邮箱：{contactEmail}</li>}
                {githubUrl && <li><a href={githubUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a></li>}
                {twitterUrl && <li><a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Twitter</a></li>}
                {!contactEmail && !githubUrl && !twitterUrl && <li>暂无联系方式</li>}
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground space-y-1">
            {footerText ? (
              <p>{footerText}</p>
            ) : (
              <p>{"\u00A9"} {currentYear} {siteName}. All rights reserved.</p>
            )}
            {icpNumber && <p>{icpNumber}</p>}
          </div>
        </div>
      </div>
    </footer>
  )
}