"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { RichEditor } from "./RichEditor"
import { Loader2, Send, X } from "lucide-react"

interface AnswerFormProps {
  questionId: string
  userId: string | undefined
  /** If provided, form is in edit mode */
  editAnswerId?: string
  editInitialContent?: string
  onCancelEdit?: () => void
}

export function AnswerForm({
  questionId,
  userId,
  editAnswerId,
  editInitialContent,
  onCancelEdit,
}: AnswerFormProps) {
  const t = useTranslations("questions")
  const tc = useTranslations("common")
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [content, setContent] = useState(editInitialContent || "")
  const isEditing = !!editAnswerId

  const handleSubmit = useCallback(async () => {
    if (!userId) {
      router.push("/login")
      return
    }
    if (!content || submitting) return

    setSubmitting(true)
    try {
      if (isEditing) {
        const res = await fetch(`/api/answers/${editAnswerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        if (res.ok) {
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)
          router.refresh()
          onCancelEdit?.()
        }
      } else {
        const res = await fetch(`/api/questions/${questionId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, content }),
        })
        if (res.ok) {
          setContent("")
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)
          router.refresh()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }, [userId, content, questionId, router, submitting, isEditing, editAnswerId, onCancelEdit])

  if (!userId) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-sm text-muted-foreground">{tc("loginRequiredAnswer")}</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          {tc("goToLogin")}
        </button>
      </div>
    )
  }

  return (
    <div>
      {isEditing && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{t("editAnswer")}</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"
          >
            <X className="h-3 w-3" />
            {tc("cancel")}
          </button>
        </div>
      )}
      <RichEditor
        value={content}
        onChange={setContent}
        placeholder={isEditing ? t("answerEditPlaceholder") : t("answerPlaceholder")}
        minHeight="150px"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !content}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
          <Send className="h-3 w-3" />
          {submitting ? tc("submitting") : isEditing ? t("updateAnswer") : t("submitAnswer")}
        </button>
      </div>
      {success && (
        <p className="mt-2 text-sm text-green-600">
          {isEditing ? t("answerUpdated") : t("answerPosted")}
        </p>
      )}
    </div>
  )
}