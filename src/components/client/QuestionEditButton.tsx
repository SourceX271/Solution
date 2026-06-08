"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { RichEditor } from "./RichEditor"
import { Loader2, Pencil, X } from "lucide-react"

interface QuestionEditProps {
  questionId: string
  initialTitle: string
  initialContent: string
  userId: string | undefined
}

export function QuestionEditButton({ questionId, initialTitle, initialContent, userId }: QuestionEditProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("请输入标题")
      return
    }
    if (!content) {
      setError("请输入内容")
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
        throw new Error(data.error || "更新失败")
      }

      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "更新失败")
    } finally {
      setSaving(false)
    }
  }, [title, content, questionId, router])

  return (
    <>
      {!editing && userId && (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs hover:bg-accent"
        >
          <Pencil className="h-3 w-3" />
          编辑问题
        </button>
      )}

      {editing && (
        <div className="mb-6 rounded-lg border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">编辑问题</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"
            >
              <X className="h-3 w-3" />
              取消
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={200}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">内容</label>
              <RichEditor
                value={content}
                onChange={setContent}
                placeholder="编辑问题内容..."
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
                {saving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}