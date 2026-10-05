"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

/**
 * Rebuild every tag's denormalized usageCount from its relations.
 * The badge next to it is the number of rows that currently disagree.
 */
export function RecomputeButton({ driftCount }: { driftCount: number }) {
  const router = useRouter()
  const t = useTranslations("admin.tagsUi")
  const [loading, setLoading] = useState(false)

  async function handleRecompute() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/tags/recompute", { method: "POST" })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(t("recomputeDone", { total: data?.total ?? 0, updated: data?.updated ?? 0 }))
        router.refresh()
      } else {
        toast.error(t("recomputeFailed"))
      }
    } catch {
      toast.error(t("recomputeFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={driftCount > 0 ? "default" : "outline"}
      size="sm"
      onClick={handleRecompute}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      {loading ? t("working") : t("recompute")}
    </Button>
  )
}
