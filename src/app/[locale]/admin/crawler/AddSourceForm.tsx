"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2 } from "lucide-react"

const CATEGORIES = ["tech", "ai", "frontend", "backend", "devops", "other"]

export function AddSourceForm() {
  const router = useRouter()
  const t = useTranslations("admin.crawlerUi")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [category, setCategory] = useState("tech")

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !url.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/crawler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), category }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(t("sourceCreated"))
        setOpen(false)
        setName("")
        setUrl("")
        setCategory("tech")
        router.refresh()
      } else {
        toast.error(data?.error || t("sourceCreateFailed"))
      }
    } catch {
      toast.error(t("sourceCreateFailedNetwork"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("addSource")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("addSourceTitle")}</DialogTitle>
            <DialogDescription>{t("addSourceDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="crawl-source-name">{t("sourceName")}</Label>
              <Input
                id="crawl-source-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("sourceNamePlaceholder")}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crawl-source-url">{t("sourceUrl")}</Label>
              <Input
                id="crawl-source-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://..."
                type="url"
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crawl-source-category">{t("sourceCategory")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="crawl-source-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? t("adding") : t("addSource")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
