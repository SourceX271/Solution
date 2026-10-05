"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, Loader2 } from "lucide-react"

interface CommentActionsProps {
  commentId: string
  excerpt: string
  replyCount: number
}

export function CommentActions({ commentId, excerpt, replyCount }: CommentActionsProps) {
  const router = useRouter()
  const t = useTranslations("admin.commentsUi")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/comments/${commentId}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(
          data?.repliesKept
            ? t("deleteDoneWithReplies", { count: data.repliesKept })
            : t("deleteDone")
        )
        setOpen(false)
        router.refresh()
      } else {
        toast.error(data?.error || tc("deleteFailed"))
      }
    } catch {
      toast.error(tc("deleteFailedNetwork"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title={t("delete")}
        aria-label={t("delete")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {replyCount > 0 ? t("deleteDescWithReplies", { count: replyCount }) : t("deleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <blockquote className="line-clamp-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            {excerpt}
          </blockquote>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? tc("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
