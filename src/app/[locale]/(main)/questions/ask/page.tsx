"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { RichEditor } from "@/components/client/RichEditor"
import { Loader2 } from "lucide-react"

export default function AskQuestionPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError("请输入问题标题")
      return
    }
    if (!content) {
      setError("请输入问题内容")
      return
    }
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          tags: tags
            ? JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean))
            : "[]",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "发布失败")
      }

      const question = await res.json()
      router.push(`/questions/${question.slug}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "发布失败，请重试")
    } finally {
      setSaving(false)
    }
  }, [title, tags, content, router])

  if (status === "loading") {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">请先登录</h1>
        <p className="mb-6 text-muted-foreground">你需要登录后才能提问</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          去登录
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">提出问题</h1>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="简明扼要地描述你的问题"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={200}
          />
        </div>

        {/* Content */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            内容 <span className="text-red-500">*</span>
          </label>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="详细描述你的问题...（支持 Markdown 切换）"
            minHeight="250px"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">标签</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，如: react, typescript"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "发布中..." : "发布问题"}
        </button>
      </div>
    </div>
  )
}