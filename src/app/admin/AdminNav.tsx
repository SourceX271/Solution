"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, FileText, Users, Radio, Settings } from "lucide-react"

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/crawler", label: "Crawler", icon: Radio },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        )
      })}
    </>
  )
}