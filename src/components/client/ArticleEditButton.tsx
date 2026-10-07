"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { RichEditor } from "./RichEditor"
import { Loader2, Pencil, X } from "lucide-react"

interface ArticleEditProps {
  articleId: string
  initialTitle: string
  initialContent: string
  initialExcerpt: string
  initialProblem: string
  initialCategory: string
  userId: string | undefined
}

export function ArticleEditButton({
  articleId, initialTitle, initialContent, initialExcerpt, initialProblem, initialCategory, userId,
}: ArticleEditProps) {
  const t = useTranslations("docs")
  const tc = useTranslations("common")
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [excerpt, setExcerpt] = useState(initialExcerpt)
  const [problem, setProblem] = useState(initialProblem)
  const [category, setCategory] = useState(initialCategory)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const CATEGORIES = [
    { value: "solution", label: t("categorySolution") },
    { value: "tutorial", label: t("categoryTutorial") },
    { value: "guide", label: t("categoryGuide") },
    { value: "reference", label: t("categoryReference") },
    { value: "news", label: t("categoryNews") },
  ]

  const handleSave = async () => {
    if (!title.trim()) { setError(tc("titleRequired")); return }
    if (!content) { setError(tc("contentRequired")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content, excerpt: excerpt.trim() || undefined, problem: problem.trim(), category }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || tc("updateFailed"))
      }
      setEditing(false); router.refresh()
    } catch (err: any) {
      setError(err.message || tc("updateFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {!editing && userId && (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> {t("editSolution")}
        </button>
      )}

      {editing && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-lg animate-scale-in">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("editSolutionTitle")}</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" /> {tc("cancel")}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="article-edit-field-1" className="mb-1.5 block text-xs font-medium">{tc("title")}</label>
              <input id="article-edit-field-1"
                type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                maxLength={200}
              />
            </div>

            <div>
              <label htmlFor="article-edit-field-2" className="mb-1.5 block text-xs font-medium">{t("problemTitle")}</label>
              <input id="article-edit-field-2"
                type="text" value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={t("problemPlaceholder")}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div>
              <label htmlFor="article-edit-field-3" className="mb-1.5 block text-xs font-medium">{tc("excerpt")}</label>
              <textarea id="article-edit-field-3"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder={t("excerptPlaceholder")}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-y min-h-[60px]"
                maxLength={500}
                rows={2}
              />
            </div>

            <div>
              <label htmlFor="article-edit-field-4" className="mb-1.5 block text-xs font-medium">{tc("category")}</label>
              <select id="article-edit-field-4"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="article-edit-editor-label-101" className="mb-1.5 block text-xs font-medium">{tc("content")}</label>
              <RichEditor id="article-edit-editor-label-101" labelledBy="article-edit-editor-label-101" value={content} onChange={setContent} placeholder={t("editContentPlaceholder")} minHeight="250px" />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-accent transition-colors"
              >
                {tc("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium shadow-md disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? tc("saving") : t("saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
