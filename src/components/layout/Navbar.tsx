"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  Moon, Sun, Search, Menu, X, User, Settings, LogOut, Shield,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/docs", label: "解决方案" },
  { href: "/questions", label: "问答" },
  { href: "/software", label: "软件" },
]

export function Navbar() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push("/search?q=" + encodeURIComponent(searchQuery.trim()))
      setSearchQuery("")
    }
  }

  const user = session?.user

  return (
    <header className="glass-nav">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold tracking-tight">Solution</Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2 flex-1 max-w-xs mx-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="搜索..." className="pl-8 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="切换主题">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
                      <AvatarFallback>{user.name?.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>我的账户</DropdownMenuLabel>
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
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>登录</Button>
                <Button size="sm" onClick={() => router.push("/register")}>注册</Button>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="菜单">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t">
          <div className="px-4 py-3 space-y-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="搜索..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </form>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-accent" onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <div className="border-t pt-3">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
                      <AvatarFallback>{user.name?.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.name}</span>
                  </div>
                  <Link href="/profile" className="block px-3 py-2 rounded-md text-sm hover:bg-accent" onClick={() => setMobileOpen(false)}>个人资料</Link>
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className="block px-3 py-2 rounded-md text-sm hover:bg-accent" onClick={() => setMobileOpen(false)}>管理后台</Link>
                  )}
                  <button className="block w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent" onClick={() => signOut()}>退出登录</button>
                </div>
              ) : (
                <div className="flex gap-2 px-3">
                  <Button variant="outline" size="sm" onClick={() => router.push("/login")}>登录</Button>
                  <Button size="sm" onClick={() => router.push("/register")}>注册</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}