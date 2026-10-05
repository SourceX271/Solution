"use client"

import { useState } from "react"
import { Link } from "@/i18n/routing"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Eye, Pencil, Trash2, EyeOff, Upload, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface ContentActionsProps {
  type: string
  id: string
  slug?: string
  status: string
}

// Public detail routes are keyed by slug, not by database id, and articles live
// under /solutions — the old /docs links 404'd.
const PUBLIC_PREFIX: Record<string, string> = {
  articles: "/solutions",
  questions: "/questions",
  software: "/software",
}

/** Which status makes an item visible on the public site. */
const PUBLIC_STATUS: Record<string, string> = {
  articles: "published",
  questions: "open",
  software: "published",
}

const HIDDEN_STATUS: Record<string, string> = {
  articles: "draft",
  questions: "closed",
  software: "pending",
}

export function ContentActions({ type, id, slug, status }: ContentActionsProps) {
  const router = useRouter()
  const t = useTranslations("common")
  const ta = useTranslations("admin.contentUi")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)

  const publicHref = slug ? `${PUBLIC_PREFIX[type] ?? "/solutions"}/${slug}` : null
  const isPublic = status === PUBLIC_STATUS[type]

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/content/${type}/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success(t("deleteSuccess"))
        setDeleteOpen(false)
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || t("deleteFailed"))
      }
    } catch {
      toast.error(t("deleteFailedNetwork"))
    } finally {
      setLoading(false)
    }
  }

  async function toggleVisibility() {
    setToggling(true)
    const nextStatus = isPublic ? HIDDEN_STATUS[type] : PUBLIC_STATUS[type]
    try {
      const res = await fetch(`/api/admin/content/${type}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        toast.success(isPublic ? ta("nowHidden") : ta("nowPublic"))
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || ta("statusFailed"))
      }
    } catch {
      toast.error(ta("statusFailedNetwork"))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {publicHref && (
        <Button variant="ghost" size="icon" asChild title={ta("view")}>
          <Link href={publicHref} target="_blank" rel="noopener noreferrer" aria-label={ta("view")}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleVisibility}
        disabled={toggling}
        title={isPublic ? ta("unpublish") : ta("publish")}
        aria-label={isPublic ? ta("unpublish") : ta("publish")}
      >
        {toggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPublic ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
      <Button variant="ghost" size="icon" asChild title={ta("edit")}>
        <Link href={`/admin/content/${type}/${id}/edit`} aria-label={ta("edit")}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title={ta("delete")} aria-label={ta("delete")}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ta("deleteTitle")}</DialogTitle>
            <DialogDescription>{ta("deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
