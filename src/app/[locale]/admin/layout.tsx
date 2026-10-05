import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { getSessionUser, isActiveAdmin } from "@/lib/admin-guard"
import { prisma } from "@/lib/db"
import { AdminShell } from "./AdminShell"

/** The panel is a private area: never let a crawler index it. */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = "force-dynamic"

/**
 * Defense in depth: the middleware also guards /admin, but this layout is the
 * last line of defence for every admin page. Without it a middleware matcher
 * change (or the locale-prefixed /en/admin path) would expose the whole panel.
 *
 * The role is re-read from the database because the JWT keeps the role it was
 * issued with, so a demoted — or banned — admin would otherwise stay privileged
 * until the token expires.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getSessionUser()

  if (!isActiveAdmin(user)) {
    redirect(locale === "en" ? "/en/login" : "/login")
  }

  // Badge on the Content nav entry: everything waiting for a human.
  const [pendingArticles, pendingSoftware] = await Promise.all([
    prisma.article.count({ where: { status: "draft" } }),
    prisma.software.count({ where: { status: "pending" } }),
  ])

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, image: user.image }}
      pendingCount={pendingArticles + pendingSoftware}
    >
      {children}
    </AdminShell>
  )
}
