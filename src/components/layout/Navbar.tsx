"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Moon, Sun, Search, Menu, X, User, Settings, LogOut, Shield,
  Globe, ChevronDown, BookOpen, MessageCircle, ExternalLink,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

const navLinks = [
  { href: "/", label: "首页", labelEn: "Home", icon: null },
  { href: "/docs", label: "解决方案", labelEn: "Solutions", icon: BookOpen },
  { href: "/questions", label: "问答", labelEn: "Q&A", icon: MessageCircle },
  { href: "/software", label: "软件", labelEn: "Software", icon: ExternalLink },
]

export function Navbar() {
  const { data: session } = useSession()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push("/search?q=" + encodeURIComponent(searchQuery.trim()))
      setSearchQuery("")
      setMobileOpen(false)
    }
  }

  const user = session?.user
  const locale = typeof window !== "undefined" && window.location.pathname.startsWith("/en") ? "en" : "zh"

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "glass shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-white font-bold text-sm shadow-md shadow-primary/25 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
            S
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text hidden sm:block">
            Solution
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground group/nav"
              >
                {link.label}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-0 rounded-full bg-primary transition-all duration-300 group-hover/nav:w-4" />
              </Link>
            )
          })}
        </nav>

        {/* Desktop Search */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2 flex-1 max-w-xs mx-4">
          <div className="relative w-full group/search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
            <Input
              type="search"
              placeholder="搜索..."
              className="pl-9 h-9 rounded-full border-muted-foreground/20 bg-muted/50 focus:bg-background transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="切换主题"
            >
              <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          )}

          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hidden sm:flex">
                <Globe className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => router.push("/")} className={cn(locale === "zh" && "bg-accent")}>
                中文
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/en")} className={cn(locale === "en" && "bg-accent")}>
                English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-1">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 rounded-full px-2">
                    <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                      <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
                      <AvatarFallback className="text-xs gradient-primary text-white">
                        {user.name?.slice(0, 2).toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium max-w-[100px] truncate">{user.name}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="mr-2 h-4 w-4" />个人资料
                  </DropdownMenuItem>
                  {user.role === "ADMIN" && (
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      <Shield className="mr-2 h-4 w-4" />管理后台
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />设置
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => router.push("/login")}>
                  登录
                </Button>
                <Button size="sm" className="rounded-full btn-gradient" onClick={() => router.push("/register")}>
                  注册
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="菜单"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden animate-slide-down glass border-t">
          <div className="px-4 py-3 space-y-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索..."
                className="pl-9 rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                    {link.label}
                  </Link>
                )
              })}
            </div>
            <div className="border-t pt-3 space-y-2">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3">
                    <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                      <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
                      <AvatarFallback className="gradient-primary text-white text-xs">
                        {user.name?.slice(0, 2).toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" onClick={() => setMobileOpen(false)}>
                    <User className="h-4 w-4 text-muted-foreground" />个人资料
                  </Link>
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" onClick={() => setMobileOpen(false)}>
                      <Shield className="h-4 w-4 text-muted-foreground" />管理后台
                    </Link>
                  )}
                  <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent" onClick={() => setMobileOpen(false)}>
                    <Settings className="h-4 w-4 text-muted-foreground" />设置
                  </Link>
                  <button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 text-destructive transition-colors" onClick={() => { signOut(); setMobileOpen(false); }}>
                    <LogOut className="h-4 w-4" />退出登录
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-3">
                  <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => { router.push("/login"); setMobileOpen(false); }}>
                    登录
                  </Button>
                  <Button size="sm" className="flex-1 rounded-full btn-gradient" onClick={() => { router.push("/register"); setMobileOpen(false); }}>
                    注册
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
