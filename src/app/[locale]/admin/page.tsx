import { redirect } from "next/navigation"

/** `/admin` itself has no dashboard: send the visitor to the locale's dashboard. */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(locale === "en" ? "/en/admin/dashboard" : "/admin/dashboard")
}
