"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Play, Power } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface CrawlerActionsProps {
  sourceId: string
  enabled: boolean
}

export function CrawlerActions({ sourceId, enabled }: CrawlerActionsProps) {
  const router = useRouter()
  const t = useTranslations("admin")
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [running, setRunning] = useState(false)

  async function handleToggle() {
    const newState = !isEnabled
    setIsEnabled(newState)
    try {
      const res = await fetch(`/api/admin/crawler/${sourceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newState }),
      })
      if (!res.ok) {
        // fetch resolves on 4xx/5xx, so check the status explicitly.
        setIsEnabled(!newState)
        toast.error(t("crawlerStatusFailed"))
        return
      }
      router.refresh()
    } catch {
      setIsEnabled(!newState)
      toast.error(t("crawlerStatusFailedNetwork"))
    }
  }

  async function handleRunNow() {
    setRunning(true)
    try {
      const res = await fetch(`/api/admin/crawler/${sourceId}/run`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success !== false) {
        toast.success(data?.message || t("crawlerRunDone"))
      } else {
        toast.error(data?.error || data?.message || t("crawlerRunFailed"))
      }
      router.refresh()
    } catch {
      toast.error(t("crawlerRunFailedNetwork"))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-2 mr-2">
        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
        <span className="text-xs text-muted-foreground">
          {isEnabled ? "On" : "Off"}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRunNow}
        disabled={running || !isEnabled}
      >
        <Play className="h-3 w-3 mr-1" />
        {running ? "Running..." : "Run Now"}
      </Button>
    </div>
  )
}
