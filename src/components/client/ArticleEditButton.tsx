"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

const CATEGORIES = [
  { value: "solution", label: "解决方案" },
  { value: "tutorial", label: "教程" },
  { value: "guide", label: "指南" },
  { value: "reference", label: "参考" },
  { value: "news", label: "资讯" },
]

export function ArticleEditButton({
  articleId, initialTitle, initialContent, initialExcerpt, initialProblem, initialCategory, userId,
}: ArticleEditProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [excerpt, setExcerpt] = useState(initialExcerpt)
  const [problem, setProblem] = useState(initialProblem)
  const [category, setCategory] = useState(initialCategory)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!title.trim()) { setError("请输入标题"); return }
    if (!content) { setError("请输入内容"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content, excerpt: excerpt.trim() || undefined, problem: problem.trim() || undefined, category }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "更新失败")
      }
      setEditing(false); router.refresh()
    } catch (err: any) {
      setError(err.message || "更新失败")
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
          <Pencil className="h-3.5 w-3.5" /> 编辑方案
        </button>
      )}

      {editing && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-lg animate-scale-in">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">编辑解决方案</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" /> 取消
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">标题</label>
              <input
                type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">遇到的问题</label>
              <input
                type="text" value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="描述这篇文章要解决的问题（可选）"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">摘要</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="文章摘要，用于列表页展示（可选）"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-y min-h-[60px]"
                maxLength={500}
                rows={2}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">分类</label>
              <select
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
              <label className="mb-1.5 block text-xs font-medium">内容</label>
              <RichEditor value={content} onChange={setContent} placeholder="编辑方案内容..." minHeight="250px" />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-accent transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium shadow-md disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
