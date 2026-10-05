"use client"

import { useEffect, useState } from "react"
import { Link, usePathname, useRouter } from "@/i18n/routing"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { useLocale, useTranslations } from "next-intl"
import {
  LayoutDashboard, FileText, MessageSquare, Users, Radio, ScrollText, Settings,
  PanelLeft, Menu, X, ChevronLeft, LogOut, Moon, Sun, Globe, ShieldCheck, Tags,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/Logo"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface NavItem {
  href: string
  key: "dashboard" | "content" | "comments" | "users" | "crawler" | "audit" | "tags" | "settings"
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const NAV_GROUPS: { labelKey: "groupOverview" | "groupModeration" | "groupSystem"; items: NavItem[] }[] = [
  {
    labelKey: "groupOverview",
    items: [{ href: "/admin/dashboard", key: "dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "groupModeration",
    items: [
      { href: "/admin/content", key: "content", icon: FileText },
      { href: "/admin/tags", key: "tags", icon: Tags },
      { href: "/admin/comments", key: "comments", icon: MessageSquare },
      { href: "/admin/users", key: "users", icon: Users },
    ],
  },
  {
    labelKey: "groupSystem",
    items: [
      { href: "/admin/crawler", key: "crawler", icon: Radio },
      { href: "/admin/audit", key: "audit", icon: ScrollText },
      { href: "/admin/settings", key: "settings", icon: Settings },
    ],
  },
]

interface AdminShellProps {
  children: React.ReactNode
  user: { name: string | null; email: string; image: string | null }
  /** Number of items waiting for review, shown as a badge on Content. */
  pendingCount?: number
}

export function AdminShell({ children, user, pendingCount = 0 }: AdminShellProps) {
  const t = useTranslations("admin")
  const tc = useTranslations("nav")
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCollapsed(window.localStorage.getItem("admin-sidebar-collapsed") === "1")
  }, [])

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Escape closes the mobile drawer, matching the rest of the site.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous
      window.localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push("/")
    router.refresh()
  }

  function switchLocale(next: string) {
    router.replace(pathname, { locale: next as "zh" | "en" })
  }

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2 rounded-lg font-semibold gradient-text"
          onClick={() => setMobileOpen(false)}
        >
          <Logo className="h-7 w-7" />
          {!collapsed && <span>{t("panel")}</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          aria-expanded={!collapsed}
          className="ml-auto hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:block"
        >
          <PanelLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={t("closeMenu")}
          className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label={t("panel")} className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(group.labelKey)}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const badge = item.key === "content" ? pendingCount : 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? t(item.key) : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="flex-1">{t(item.key)}</span>}
                  {!collapsed && badge > 0 && (
                    <Badge
                      variant={active ? "secondary" : "warning"}
                      className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums"
                    >
                      {badge > 99 ? "99+" : badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t p-3">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            collapsed && "justify-center"
          )}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("backToSite")}</span>}
        </Link>
        <div className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", collapsed && "justify-center")}>
          <Avatar className="h-7 w-7 ring-2 ring-primary/20">
            <AvatarImage src={user.image ?? ""} alt="" />
            <AvatarFallback className="text-[11px] gradient-primary text-white">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.name ?? t("unnamed")}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label={tc("logout")}
            title={tc("logout")}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "glass sticky top-0 hidden h-screen shrink-0 border-r transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="glass fixed inset-y-0 left-0 z-[80] w-72 border-r lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t("panel")}
          >
            {sidebar}
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">{t("panel")}</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => switchLocale(locale === "zh" ? "en" : "zh")}
              aria-label={tc("switchLanguage")}
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium">{locale === "zh" ? "EN" : tc("chinese")}</span>
            </Button>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label={tc("toggleTheme")}
              >
                <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            )}
          </div>
        </header>

        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  )
}
