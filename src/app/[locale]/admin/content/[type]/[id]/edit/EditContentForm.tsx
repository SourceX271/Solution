"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { RichTextEditor } from "./RichTextEditor"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { formatDate } from "@/lib/utils"

interface EditContentFormProps {
  type: string
  item: any
}

const articleCategories = ["solution", "tutorial", "guide", "reference", "news"]
const softwareCategories = ["tool", "library", "framework", "service", "platform", "other"]

export function EditContentForm({ type, item }: EditContentFormProps) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const td = useTranslations("docs")
  const locale = useLocale()
  const categoryLabels: Record<string, string> = {
    solution: td("categorySolution"),
    tutorial: td("categoryTutorial"),
    guide: td("categoryGuide"),
    reference: td("categoryReference"),
    news: td("categoryNews"),
  }
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState(item.title || item.name || "")
  const [content, setContent] = useState(item.content || item.description || "")
  const [problem, setProblem] = useState(item.problem || "")
  const [excerpt, setExcerpt] = useState(item.excerpt || "")
  const [category, setCategory] = useState(item.category || "tutorial")
  const [status, setStatus] = useState(item.status || "draft")
  const [tags, setTags] = useState(
    // The API returns the tag relation; a raw array used to render as "[object Object]".
    Array.isArray(item.tags)
      ? item.tags.map((t: { name?: string }) => t.name).filter(Boolean).join(", ")
      : item.tags || ""
  )
  const [url, setUrl] = useState(item.url || "")
  const [coverImage, setCoverImage] = useState(item.coverImage || "")
  const [image, setImage] = useState(item.image || "")
  const [description, setDescription] = useState(item.description || "")

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { status }
      if (type === "articles") {
        body.title = title
        body.content = content
        body.problem = problem || null
        body.excerpt = excerpt || null
        body.category = category
        body.tags = tags
        body.coverImage = coverImage || null
      } else if (type === "questions") {
        body.title = title
        body.content = content
        body.tags = tags
      } else if (type === "software") {
        body.name = title
        body.description = description || content
        body.url = url || null
        body.category = category
        body.tags = tags
        body.image = image || null
      }

      const res = await fetch("/api/admin/content/" + type + "/" + item.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(tc("saveSuccess"))
        router.refresh()
        router.push("/admin/content?type=" + type)
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || tc("saveFailed"))
      }
    } catch {
      toast.error(tc("saveFailedNetwork"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/content/" + type + "/" + item.id, { method: "DELETE" })
      if (res.ok) {
        toast.success(tc("deleteSuccess"))
        router.push("/admin/content?type=" + type)
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || tc("deleteFailed"))
      }
    } catch {
      toast.error(tc("deleteFailedNetwork"))
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={"/admin/content?type=" + type} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />{tc("back")}
        </Link>
        <div className="flex items-center gap-3">
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tc("deleteConfirmTitle")}</DialogTitle>
                <DialogDescription>{tc("deleteConfirmText")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>{tc("cancel")}</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? tc("deleting") : tc("delete")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />{saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">{t("contentEdit")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{type === "software" ? t("softwareName") : t("contentTitle")}</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "software" ? t("namePlaceholder") : t("titlePlaceholder")} />
              </div>

              {type === "articles" && (
                <div className="space-y-2">
                  <Label htmlFor="problem">{tc("problem")}</Label>
                  <Textarea id="problem" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder={t("problemPlaceholder")} rows={3} />
                </div>
              )}

              {type === "software" && (
                <div className="space-y-2">
                  <Label htmlFor="url">{t("urlLabel")}</Label>
                  <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}

              {type === "articles" && (
                <div className="space-y-2">
                  <Label htmlFor="excerpt">{t("excerptLabel")}</Label>
                  <Textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder={t("excerptPlaceholder")} rows={2} />
                </div>
              )}

              <div className="space-y-2">
                <Label>{type === "software" ? t("descriptionLabel") : t("contentLabel")}</Label>
                <RichTextEditor content={content} onChange={setContent} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">{t("status")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {type === "articles" && (<><SelectItem value="published">{t("statusPublished")}</SelectItem><SelectItem value="draft">{t("statusDraft")}</SelectItem></>)}
                    {type === "questions" && (<><SelectItem value="open">{t("statusOpen")}</SelectItem><SelectItem value="closed">{t("statusClosed")}</SelectItem><SelectItem value="resolved">{t("statusSolved")}</SelectItem></>)}
                    {type === "software" && (<><SelectItem value="published">{t("statusPublished")}</SelectItem><SelectItem value="pending">{t("statusPending")}</SelectItem></>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(type === "software" ? softwareCategories : articleCategories).map((cat) => (
                      <SelectItem key={cat} value={cat}>{categoryLabels[cat] || cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tagsLabel")}</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("tagsPlaceholder")} />
              </div>
              {(type === "articles" || type === "software") && (
                <div className="space-y-2">
                  <Label>{type === "articles" ? t("coverImage") : t("image")}</Label>
                  <Input value={type === "articles" ? coverImage : image} onChange={(e) => type === "articles" ? setCoverImage(e.target.value) : setImage(e.target.value)} placeholder="https://..." />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">{t("infoTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("author")}</span><span>{item.author?.name || tc("noName")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("createdAt")}</span><span>{formatDate(item.createdAt, locale)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("updatedAt")}</span><span>{formatDate(item.updatedAt, locale)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
