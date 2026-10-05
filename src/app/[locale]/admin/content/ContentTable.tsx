"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { ContentActions } from "./ContentActions"
import { CheckSquare, Eye, Trash2, Upload, FileDown, Loader2 } from "lucide-react"
import { formatDate } from "@/lib/utils"

export interface ContentRow {
  id: string
  title: string
  slug: string
  status: string
  /** Localized status name; falls back to the raw value. */
  statusLabel?: string
  authorName: string
  createdAt: string
  meta?: string
}

export type ContentTypeKey = "articles" | "questions" | "software"
type BulkAction = "publish" | "unpublish" | "delete"

interface ContentTableProps {
  type: ContentTypeKey
  rows: ContentRow[]
  emptyLabel: string
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  published: "success",
  draft: "warning",
  open: "success",
  closed: "secondary",
  solved: "default",
  pending: "warning",
}

export function ContentTable({ type, rows, emptyLabel }: ContentTableProps) {
  const t = useTranslations("admin.contentUi")
  const locale = useLocale()
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allSelected = rows.length > 0 && selected.length === rows.length
  const someSelected = selected.length > 0 && !allSelected
  const selectedCount = selected.length

  const selectedLabel = useMemo(() => t("selected", { count: selectedCount }), [t, selectedCount])

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((row) => row.id))
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }

  async function runBulk(action: BulkAction) {
    setBusy(true)
    try {
      const res = await fetch("/api/admin/content/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, action, ids: selected }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(
          action === "delete"
            ? t("bulkDeleted", { count: data?.affected ?? selectedCount })
            : t("bulkUpdated", { count: data?.affected ?? selectedCount })
        )
        setSelected([])
        setConfirmDelete(false)
        router.refresh()
      } else {
        toast.error(data?.error || t("bulkFailed"))
      }
    } catch {
      toast.error(t("bulkFailedNetwork"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — only rendered while a selection exists. */}
      {selectedCount > 0 && (
        <div
          role="region"
          aria-label={t("bulkRegion")}
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/50 p-3"
        >
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{selectedLabel}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("publish")}>
              <Upload className="mr-2 h-4 w-4" />
              {t("publish")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => runBulk("unpublish")}>
              <FileDown className="mr-2 h-4 w-4" />
              {t("unpublish")}
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmDelete(true)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {t("delete")}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected([])}>
              {t("clearSelection")}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                checked={allSelected}
                ref={(node) => {
                  if (node) node.indeterminate = someSelected
                }}
                onChange={toggleAll}
                aria-label={t("selectAll")}
                disabled={rows.length === 0}
              />
            </TableHead>
            <TableHead>{t("columnTitle")}</TableHead>
            <TableHead>{t("columnAuthor")}</TableHead>
            <TableHead>{t("columnStatus")}</TableHead>
            <TableHead>{t("columnDate")}</TableHead>
            <TableHead className="text-right">{t("columnActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const isSelected = selected.includes(row.id)
              return (
                <TableRow key={row.id} data-state={isSelected ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                      checked={isSelected}
                      onChange={() => toggleOne(row.id)}
                      aria-label={t("selectRow", { title: row.title })}
                    />
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <p className="truncate font-medium" title={row.title}>
                      {row.title}
                    </p>
                    {row.meta && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {row.meta}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{row.authorName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>
                      {row.statusLabel ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(row.createdAt, locale)}</TableCell>
                  <TableCell className="text-right">
                    <ContentActions type={type} id={row.id} slug={row.slug} status={row.status} />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bulkDeleteTitle")}</DialogTitle>
            <DialogDescription>{t("bulkDeleteDesc", { count: selectedCount })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => runBulk("delete")} disabled={busy}>
              {busy ? t("working") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
