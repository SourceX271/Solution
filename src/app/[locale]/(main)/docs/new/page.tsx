"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { RichEditor } from "@/components/client/RichEditor"
import { Loader2, ArrowLeft } from "lucide-react"

export default function NewDocPage() {
  const t = useTranslations("docs")
  const tc = useTranslations("common")
  const router = useRouter()
  const { data: session, status } = useSession()
  const [title, setTitle] = useState("")
  const [problem, setProblem] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [category, setCategory] = useState("solution")
  const [tags, setTags] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const CATEGORIES = [
    { value: "solution", label: t("categorySolution") },
    { value: "tutorial", label: t("categoryTutorial") },
    { value: "guide", label: t("categoryGuide") },
    { value: "reference", label: t("categoryReference") },
    { value: "news", label: t("categoryNews") },
  ]

  const handleSubmit = async () => {
    if (!title.trim()) { setError(tc("titleRequired")); return }
    if (!content) { setError(tc("contentRequired")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          excerpt: excerpt.trim() || undefined,
          problem: problem.trim(),
          category,
          tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)) : "[]",
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || tc("publishFailed"))
      }
      const article = await res.json()
      router.push(`/docs/${article.slug}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || tc("publishFailedRetry"))
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
        <p className="mb-6 text-muted-foreground">{tc("loginRequiredDocs")}</p>
        <Link href="/login" className="btn-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25">
          {tc("goToLogin")}
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 animate-fade-in">
      <Link href="/docs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> {t("backToList")}
      </Link>

      <h1 className="text-3xl font-bold gradient-text mb-8">{t("publishTitle")}</h1>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{tc("titleLabel")} <span className="text-red-500">*</span></label>
          <input
            type="text" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            maxLength={200}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("problemTitle")}</label>
          <input
            type="text" value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder={t("problemPlaceholder")}
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <label className="mb-1.5 block text-sm font-medium">{tc("tags")}</label>
            <input
              type="text" value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={tc("tagsPlaceholder")}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">{tc("excerpt")}</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder={t("excerptPlaceholder")}
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-y min-h-[60px]"
            maxLength={500}
            rows={2}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">{tc("content")} <span className="text-red-500">*</span></label>
          <RichEditor value={content} onChange={setContent} placeholder={t("contentPlaceholder")} minHeight="300px" />
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
          {saving ? tc("publishing") : t("publish")}
        </button>
      </div>
    </div>
  )
}
