import Link from "next/link"

const footerLinks = [
  { href: "/about", label: "关于我们" },
  { href: "/help", label: "帮助中心" },
  { href: "/privacy", label: "隐私政策" },
  { href: "/contact", label: "联系我们" },
]

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto">
      <div className="glass border-t border-b-0 rounded-none">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Brand */}
            <div>
              <h3 className="text-lg font-bold">Solution</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                您的智能知识平台 — 高效管理文档、问答与软件资源，助力团队协作与知识沉淀。
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold">快速链接</h4>
              <ul className="mt-3 space-y-2">
                {footerLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold">联系方式</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>邮箱: support@solution.com</li>
                <li>电话: 400-000-0000</li>
                <li>地址: 北京市海淀区</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
            © {currentYear} Solution. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
