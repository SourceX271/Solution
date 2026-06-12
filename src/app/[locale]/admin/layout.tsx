import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AdminNav } from "./AdminNav"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminNav />

      <div className="ml-64 flex-1">
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b px-8">
          <h1 className="text-lg font-semibold gradient-text">Admin Panel</h1>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-3 py-1.5 hover:bg-accent"
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
