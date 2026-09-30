import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AdminNav } from "./AdminNav"

/**
 * Defense in depth: the middleware also guards /admin, but this layout is the
 * last line of defence for every admin page. Without it a middleware matcher
 * change (or the locale-prefixed /en/admin path) would expose the whole panel.
 *
 * The role is re-read from the database because the JWT keeps the role it was
 * issued with, so a revoked admin would otherwise stay privileged until the
 * token expires.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  const userId = (session?.user as any)?.id as string | undefined

  const currentUser = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    : null

  if (!session || currentUser?.role !== "ADMIN") {
    const { locale } = await params
    redirect(locale === "en" ? "/en/login" : "/login")
  }

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
