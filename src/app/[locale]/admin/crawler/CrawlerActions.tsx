"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Play, Trash2, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

interface CrawlerActionsProps {
  sourceId: string
  sourceName: string
  enabled: boolean
}

export function CrawlerActions({ sourceId, sourceName, enabled }: CrawlerActionsProps) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("admin.crawlerUi")
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [running, setRunning] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/crawler/${sourceId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(tc("sourceDeleted"))
        setDeleteOpen(false)
        router.refresh()
      } else {
        toast.error(data?.error || tc("sourceDeleteFailed"))
      }
    } catch {
      toast.error(tc("sourceDeleteFailedNetwork"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="mr-1 flex items-center gap-2">
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          aria-label={isEnabled ? tc("disableSource") : tc("enableSource")}
        />
        <span className="text-xs text-muted-foreground">{isEnabled ? tc("on") : tc("off")}</span>
      </div>
      <Button variant="outline" size="sm" onClick={handleRunNow} disabled={running || !isEnabled}>
        {running ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Play className="mr-1 h-3 w-3" />
        )}
        {running ? tc("running") : tc("runNow")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDeleteOpen(true)}
        title={tc("deleteSource")}
        aria-label={tc("deleteSource")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tc("deleteSourceTitle")}</DialogTitle>
            <DialogDescription>{tc("deleteSourceDesc", { name: sourceName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? tc("deleting") : tc("deleteSource")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
