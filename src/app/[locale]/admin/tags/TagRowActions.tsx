"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Pencil, Trash2, Combine } from "lucide-react"

interface TagSummary {
  id: string
  name: string
  slug: string
  color: string
  description: string | null
  actualCount: number
}

interface TagRowActionsProps {
  tag: TagSummary
  /** Every other tag, offered as a merge target. */
  candidates: { id: string; name: string }[]
}

export function TagRowActions({ tag, candidates }: TagRowActionsProps) {
  const router = useRouter()
  const t = useTranslations("admin.tagsUi")
  const tc = useTranslations("common")

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState(tag.name)
  const [color, setColor] = useState(tag.color)
  const [description, setDescription] = useState(tag.description ?? "")
  const [targetId, setTargetId] = useState("")

  async function saveEdit() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tags/${tag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(t("saved"))
        setEditOpen(false)
        router.refresh()
      } else {
        toast.error(data?.error || t("saveFailed"))
      }
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      // The API refuses to strip a tag that is still in use unless the admin
      // has seen the warning, which the dialog shows before we get here.
      const force = tag.actualCount > 0 ? "?force=1" : ""
      const res = await fetch(`/api/admin/tags/${tag.id}${force}`, { method: "DELETE" })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(t("deleted"))
        setDeleteOpen(false)
        router.refresh()
      } else {
        toast.error(data?.error || t("deleteFailed"))
      }
    } catch {
      toast.error(t("deleteFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function handleMerge() {
    if (!targetId) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/tags/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: tag.id, targetId }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(t("merged", { moved: data?.moved ?? 0 }))
        setMergeOpen(false)
        router.refresh()
      } else {
        toast.error(data?.error || t("mergeFailed"))
      }
    } catch {
      toast.error(t("mergeFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditOpen(true)}
        title={t("edit")}
        aria-label={t("edit")}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMergeOpen(true)}
        title={t("merge")}
        aria-label={t("merge")}
        disabled={candidates.length === 0}
      >
        <Combine className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDeleteOpen(true)}
        title={t("delete")}
        aria-label={t("delete")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{`/tags/${tag.slug}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`tag-name-${tag.id}`}>{t("nameLabel")}</Label>
              <Input
                id={`tag-name-${tag.id}`}
                value={name}
                maxLength={30}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tag-color-${tag.id}`}>{t("colorLabel")}</Label>
              <div className="flex items-center gap-2">
                <input
                  id={`tag-color-${tag.id}`}
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
                />
                <Input value={color} onChange={(event) => setColor(event.target.value)} className="w-28 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tag-desc-${tag.id}`}>{t("descriptionLabel")}</Label>
              <Textarea
                id={`tag-desc-${tag.id}`}
                value={description}
                maxLength={200}
                rows={3}
                placeholder={t("descriptionPlaceholder")}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={loading || !name.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mergeTitle")}</DialogTitle>
            <DialogDescription>{t("mergeDesc", { name: tag.name })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`tag-merge-${tag.id}`}>{t("mergeTargetLabel")}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id={`tag-merge-${tag.id}`}>
                <SelectValue placeholder={t("mergeSelectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button onClick={handleMerge} disabled={loading || !targetId}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("mergeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDesc", { name: tag.name })}</DialogDescription>
          </DialogHeader>
          {tag.actualCount > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {t("deleteBlocked", { count: tag.actualCount })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tag.actualCount > 0 ? t("forceDelete") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
