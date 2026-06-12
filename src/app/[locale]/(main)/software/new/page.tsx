"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Loader2, ArrowLeft } from "lucide-react"
import { RichEditor } from "@/components/client/RichEditor"

const CATEGORIES = [
  { value: "tool", label: "工具" },
  { value: "development", label: "开发" },
  { value: "website", label: "网站" },
  { value: "game", label: "游戏" },
  { value: "library", label: "库/框架" },
  { value: "other", label: "其他" },
]

export default function NewSoftwarePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [category, setCategory] = useState("tool")
  const [tags, setTags] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!name.trim()) { setError("请输入软件名称"); return }
    if (!description.trim()) { setError("请输入软件描述"); return }
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
          tags: tags ? JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)) : "[]",
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "提交失败")
      }
      const software = await res.json()
      router.push(`/software/${software.slug}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "提交失败，请重试")
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
        <h1 className="mb-4 text-2xl font-bold gradient-text">请先登录</h1>
        <p className="mb-6 text-muted-foreground">你需要登录后才能提交软件</p>
        <Link href="/login" className="btn-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25">
          去登录
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 animate-fade-in">
      <Link href="/software" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> 返回列表
      </Link>

      <h1 className="text-3xl font-bold gradient-text mb-8">提交新软件</h1>

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">软件名称 <span className="text-red-500">*</span></label>
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：VS Code"
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            maxLength={100}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">描述 <span className="text-red-500">*</span></label>
          <RichEditor value={description} onChange={setDescription} placeholder="描述软件的功能和特点..." minHeight="200px" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">官网链接</label>
            <input
              type="url" value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">分类</label>
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
          <label className="mb-1.5 block text-sm font-medium">标签</label>
          <input
            type="text" value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，如: editor, code, microsoft"
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
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
          {saving ? "提交中..." : "提交软件"}
        </button>
      </div>
    </div>
  )
}
