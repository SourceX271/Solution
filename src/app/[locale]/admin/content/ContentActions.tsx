"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface ContentActionsProps {
  type: string
  id: string
  slug?: string
  status: string
}

// Public detail routes are keyed by slug, not by database id, and articles live
// under /docs — the old links 404'd.
const PUBLIC_PREFIX: Record<string, string> = {
  articles: "/docs",
  questions: "/questions",
  software: "/software",
}

export function ContentActions({ type, id, slug, status }: ContentActionsProps) {
  const router = useRouter()
  const t = useTranslations("common")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const publicHref = slug ? `${PUBLIC_PREFIX[type] ?? "/docs"}/${slug}` : null

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

  return (
    <div className="flex items-center justify-end gap-1">
      {publicHref && (
        <Button variant="ghost" size="icon" asChild title="View">
          <Link href={publicHref} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="icon" asChild title="Edit">
        <Link href={`/admin/content/${type}/${id}/edit`}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Delete">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {type.slice(0, -1)}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
