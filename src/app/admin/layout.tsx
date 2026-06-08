import Link from "next/link"
import { cn } from "@/lib/utils"
import { LayoutDashboard, FileText, Users, Radio, Settings, ArrowLeft } from "lucide-react"
import { AdminNav } from "./AdminNav"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="glass fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Site
          </Link>
        </div>
        <div className="px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin Panel</h2>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <AdminNav />
        </nav>
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">Solution Admin v1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ml-64 flex-1">
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b px-8">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Site
          </Link>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}