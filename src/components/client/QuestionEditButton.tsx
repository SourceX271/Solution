"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { RichEditor } from "./RichEditor"
import { Loader2, Pencil, X } from "lucide-react"

interface QuestionEditProps {
  questionId: string
  initialTitle: string
  initialContent: string
  userId: string | undefined
}

export function QuestionEditButton({ questionId, initialTitle, initialContent, userId }: QuestionEditProps) {
  const t = useTranslations("questions")
  const tc = useTranslations("common")
  // "保存修改" only exists as docs.saveChanges in the catalog, so this one label
  // is read from the docs namespace rather than duplicating the string.
  const td = useTranslations("docs")
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError(tc("titleRequired"))
      return
    }
    if (!content) {
      setError(tc("contentRequired"))
      return
    }
    setSaving(true)
    setError("")

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || tc("updateFailed"))
      }

      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || tc("updateFailed"))
    } finally {
      setSaving(false)
    }
    // Translators are new function identities on every render — kept out of the
    // dependency list on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, questionId, router])

  return (
    <>
      {!editing && userId && (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs hover:bg-accent"
        >
          <Pencil className="h-3 w-3" />
          {t("editQuestion")}
        </button>
      )}

      {editing && (
        <div className="mb-6 rounded-lg border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("editQuestionTitle")}</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"
            >
              <X className="h-3 w-3" />
              {tc("cancel")}
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="question-edit-field-1" className="mb-1 block text-xs font-medium">{tc("title")}</label>
              <input id="question-edit-field-1"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="question-edit-editor-label-101" className="mb-1 block text-xs font-medium">{tc("content")}</label>
              <RichEditor id="question-edit-editor-label-101" labelledBy="question-edit-editor-label-101"
                value={content}
                onChange={setContent}
                placeholder={t("editContentPlaceholder")}
                minHeight="200px"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {saving ? tc("saving") : td("saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}