"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { Loader2, ArrowLeft } from "lucide-react"
import { RichEditor } from "@/components/client/RichEditor"
import { TagPicker } from "@/components/client/TagPicker"

export default function NewSoftwarePage() {
  const t = useTranslations("software")
  const tc = useTranslations("common")
  const td = useTranslations("docs")
  const router = useRouter()
  const { data: session, status } = useSession()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [category, setCategory] = useState("tool")
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const CATEGORIES = [
    { value: "tool", label: t("categoryTool") },
    { value: "development", label: t("categoryDevelopment") },
    { value: "website", label: t("categoryWebsite") },
    { value: "game", label: t("categoryGame") },
    { value: "library", label: t("categoryLibrary") },
    { value: "other", label: t("categoryOther") },
  ]

  const handleSubmit = async () => {
    if (!name.trim()) { setError(t("nameRequired")); return }
    if (!description.trim()) { setError(t("descriptionRequired")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/software", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          url: url.trim() || undefined,
          category,
          tags,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || tc("submitFailed"))
      }
      const software = await res.json()
      router.push(`/software/${software.slug}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || tc("submitFailedRetry"))
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in">
        <h1 className="mb-4 text-2xl font-bold gradient-text">{tc("loginRequiredTitle")}</h1>
        <p className="mb-6 text-muted-foreground">{tc("loginRequiredSoftware")}</p>
        <Link href="/login" className="btn-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25">
          {tc("goToLogin")}
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 animate-fade-in">
      <Link href="/software" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> {td("backToList")}
      </Link>

      <h1 className="text-3xl font-bold gradient-text mb-8">{t("submitTitle")}</h1>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{tc("name")} <span className="text-red-500">*</span></label>
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            maxLength={100}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">{tc("description")} <span className="text-red-500">*</span></label>
          <RichEditor value={description} onChange={setDescription} placeholder={t("descriptionPlaceholder")} minHeight="200px" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("urlLabel")}</label>
            <input
              type="url" value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{tc("category")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="tags">{tc("tags")}</label>
          <TagPicker
            id="tags"
            value={tags}
            onChange={setTags}
            placeholder={t("tagsPlaceholder")}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn-gradient inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? tc("submitting") : t("submit")}
        </button>
      </div>
    </div>
  )
}
