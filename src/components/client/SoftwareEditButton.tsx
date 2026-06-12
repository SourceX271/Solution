"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RichEditor } from "./RichEditor"
import { Loader2, Pencil, X } from "lucide-react"

interface SoftwareEditProps {
  softwareId: string
  initialName: string
  initialDescription: string
  initialUrl: string
  initialCategory: string
  userId: string | undefined
}

const CATEGORIES = [
  { value: "tool", label: "工具" },
  { value: "development", label: "开发" },
  { value: "website", label: "网站" },
  { value: "game", label: "游戏" },
  { value: "library", label: "库/框架" },
  { value: "other", label: "其他" },
]

export function SoftwareEditButton({
  softwareId, initialName, initialDescription, initialUrl, initialCategory, userId,
}: SoftwareEditProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [url, setUrl] = useState(initialUrl)
  const [category, setCategory] = useState(initialCategory)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!name.trim()) { setError("请输入软件名称"); return }
    if (!description.trim()) { setError("请输入描述"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/software/${softwareId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          url: url.trim() || undefined,
          category,
        }),
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
          <Pencil className="h-3.5 w-3.5" /> 编辑软件
        </button>
      )}

      {editing && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-lg animate-scale-in">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">编辑软件信息</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" /> 取消
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">软件名称</label>
              <input
                type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">描述</label>
              <RichEditor value={description} onChange={setDescription} placeholder="编辑软件描述..." minHeight="200px" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">官网链接</label>
              <input
                type="url" value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
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
