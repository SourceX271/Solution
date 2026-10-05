"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PlayCircle, Loader2 } from "lucide-react"

/** Trigger a full crawl of every enabled source. */
export function RunAllButton() {
  const router = useRouter()
  const t = useTranslations("admin.crawlerUi")
  const [running, setRunning] = useState(false)

  async function handleRun() {
    if (!window.confirm(t("runAllConfirm"))) return
    setRunning(true)
    try {
      const res = await fetch("/api/admin/crawler/run", { method: "POST" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.status === "success") {
        toast.success(t("runAllDone", { added: data?.added ?? 0, skipped: data?.skipped ?? 0 }))
      } else {
        toast.error(data?.message || data?.error || t("runAllFailed"))
      }
      router.refresh()
    } catch {
      toast.error(t("runAllFailedNetwork"))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
      {running ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <PlayCircle className="mr-2 h-4 w-4" />
      )}
      {running ? t("running") : t("runAll")}
    </Button>
  )
}
