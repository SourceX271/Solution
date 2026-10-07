"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
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

export function SoftwareEditButton({
  softwareId, initialName, initialDescription, initialUrl, initialCategory, userId,
}: SoftwareEditProps) {
  const t = useTranslations("software")
  const tc = useTranslations("common")
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [url, setUrl] = useState(initialUrl)
  const [category, setCategory] = useState(initialCategory)
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

  const handleSave = async () => {
    if (!name.trim()) { setError(t("nameRequired")); return }
    if (!description.trim()) { setError(t("editDescriptionRequired")); return }
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
          <Pencil className="h-3.5 w-3.5" /> {t("editSoftware")}
        </button>
      )}

      {editing && (
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-lg animate-scale-in">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("editSoftwareTitle")}</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <X className="h-3.5 w-3.5" /> {tc("cancel")}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="software-edit-field-1" className="mb-1.5 block text-xs font-medium">{tc("name")}</label>
              <input id="software-edit-field-1"
                type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="software-edit-editor-label-101" className="mb-1.5 block text-xs font-medium">{tc("description")}</label>
              <RichEditor id="software-edit-editor-label-101" labelledBy="software-edit-editor-label-101" value={description} onChange={setDescription} placeholder={t("editDescriptionPlaceholder")} minHeight="200px" />
            </div>

            <div>
              <label htmlFor="software-edit-field-2" className="mb-1.5 block text-xs font-medium">{t("urlLabel")}</label>
              <input id="software-edit-field-2"
                type="url" value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("urlPlaceholder")}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div>
              <label htmlFor="software-edit-field-3" className="mb-1.5 block text-xs font-medium">{tc("category")}</label>
              <select id="software-edit-field-3"
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
                {tc("cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium shadow-md disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? tc("saving") : tc("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
