"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Save, Loader2, AlertCircle } from "lucide-react"

interface SettingsFormProps {
  config: {
    siteName: string
    siteDescription: string
    logo: string | null
    keywords: string | null
    contactEmail: string | null
    githubUrl: string | null
    twitterUrl: string | null
    footerText: string | null
    icpNumber: string | null
    featuredArticle: string | null
    featuredQuestion: string | null
    featuredSoftware: string | null
    enableSolutions: boolean
    enableQuestions: boolean
    enableSoftware: boolean
  }
  articles: { id: string; title: string }[]
  questions: { id: string; title: string }[]
  software: { id: string; name: string }[]
}

/** Radix Select forbids an empty string value, so "no selection" gets a sentinel. */
const NONE = "__none__"

export function SettingsForm({ config, articles, questions, software }: SettingsFormProps) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const tf = useTranslations("admin.settingsUi")
  const [saving, setSaving] = useState(false)

  const initial = useMemo(
    () => ({
      siteName: config.siteName,
      siteDescription: config.siteDescription,
      logo: config.logo || "",
      keywords: config.keywords || "",
      contactEmail: config.contactEmail || "",
      githubUrl: config.githubUrl || "",
      twitterUrl: config.twitterUrl || "",
      footerText: config.footerText || "",
      icpNumber: config.icpNumber || "",
      featuredArticle: config.featuredArticle || NONE,
      featuredQuestion: config.featuredQuestion || NONE,
      featuredSoftware: config.featuredSoftware || NONE,
      enableSolutions: config.enableSolutions,
      enableQuestions: config.enableQuestions,
      enableSoftware: config.enableSoftware,
    }),
    [config]
  )

  const [form, setForm] = useState(initial)
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: form.siteName,
          siteDescription: form.siteDescription,
          logo: form.logo || null,
          keywords: form.keywords || null,
          contactEmail: form.contactEmail || null,
          githubUrl: form.githubUrl || null,
          twitterUrl: form.twitterUrl || null,
          footerText: form.footerText || null,
          icpNumber: form.icpNumber || null,
          // The endpoint also normalises this sentinel; doing it here keeps the
          // request honest and the dirty check meaningful.
          featuredArticle: form.featuredArticle === NONE ? null : form.featuredArticle,
          featuredQuestion: form.featuredQuestion === NONE ? null : form.featuredQuestion,
          featuredSoftware: form.featuredSoftware === NONE ? null : form.featuredSoftware,
          enableSolutions: form.enableSolutions,
          enableQuestions: form.enableQuestions,
          enableSoftware: form.enableSoftware,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(tc("saveSuccess"))
        router.refresh()
      } else {
        toast.error(data?.error || tc("saveFailed"))
      }
    } catch {
      toast.error(tc("saveFailedNetwork"))
    } finally {
      setSaving(false)
    }
  }

  const featuredFields = [
    {
      key: "featuredArticle" as const,
      label: t("featuredArticle"),
      options: articles.map((article) => ({ value: article.id, label: article.title })),
    },
    {
      key: "featuredQuestion" as const,
      label: t("featuredQuestion"),
      options: questions.map((question) => ({ value: question.id, label: question.title })),
    },
    {
      key: "featuredSoftware" as const,
      label: t("featuredSoftware"),
      options: software.map((item) => ({ value: item.id, label: item.name })),
    },
  ]

  const features = [
    { key: "enableSolutions" as const, label: tc("solutions"), description: t("featureSolutionsDesc") },
    { key: "enableQuestions" as const, label: tc("questions"), description: t("featureQuestionsDesc") },
    { key: "enableSoftware" as const, label: tc("software"), description: t("featureSoftwareDesc") },
  ]

  return (
    <div className="space-y-6">
      {/* Basic */}
      <div className="space-y-4">
        <h3 className="border-b pb-2 text-sm font-semibold">{t("basic")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteName">{t("siteName")}</Label>
            <Input
              id="siteName"
              value={form.siteName}
              onChange={(event) => update("siteName", event.target.value)}
              placeholder="Solution"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">{tf("logoUrl")}</Label>
            <Input
              id="logo"
              value={form.logo}
              onChange={(event) => update("logo", event.target.value)}
              placeholder="https://...logo.png"
              maxLength={500}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteDescription">{t("siteDescription")}</Label>
          <Textarea
            id="siteDescription"
            value={form.siteDescription}
            onChange={(event) => update("siteDescription", event.target.value)}
            placeholder={tc("siteDescription")}
            rows={2}
            maxLength={500}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="keywords">{t("keywords")}</Label>
          <Input
            id="keywords"
            value={form.keywords}
            onChange={(event) => update("keywords", event.target.value)}
            placeholder={t("keywordsPlaceholder")}
            maxLength={500}
          />
        </div>
      </div>

      {/* Contact and social */}
      <div className="space-y-4">
        <h3 className="border-b pb-2 text-sm font-semibold">{t("social")}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
            <Input
              id="contactEmail"
              type="email"
              value={form.contactEmail}
              onChange={(event) => update("contactEmail", event.target.value)}
              placeholder="admin@example.com"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubUrl">{t("githubUrl")}</Label>
            <Input
              id="githubUrl"
              value={form.githubUrl}
              onChange={(event) => update("githubUrl", event.target.value)}
              placeholder="https://github.com/..."
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitterUrl">{t("twitterUrl")}</Label>
            <Input
              id="twitterUrl"
              value={form.twitterUrl}
              onChange={(event) => update("twitterUrl", event.target.value)}
              placeholder="https://twitter.com/..."
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-4">
        <h3 className="border-b pb-2 text-sm font-semibold">{t("footer")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="footerText">{t("footerText")}</Label>
            <Input
              id="footerText"
              value={form.footerText}
              onChange={(event) => update("footerText", event.target.value)}
              placeholder="2026 Solution. All rights reserved."
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icpNumber">{t("icp")}</Label>
            <Input
              id="icpNumber"
              value={form.icpNumber}
              onChange={(event) => update("icpNumber", event.target.value)}
              placeholder={t("icpPlaceholder")}
              maxLength={100}
            />
          </div>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="space-y-4">
        <h3 className="border-b pb-2 text-sm font-semibold">{t("features")}</h3>
        <div className="space-y-3">
          {features.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{feature.label}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
              <Switch
                checked={form[feature.key]}
                onCheckedChange={(checked) => update(feature.key, checked)}
                aria-label={feature.label}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Featured content */}
      <div className="space-y-4">
        <h3 className="border-b pb-2 text-sm font-semibold">{t("featured")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {featuredFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Select value={form[field.key]} onValueChange={(value) => update(field.key, value)}>
                <SelectTrigger id={field.key}>
                  <SelectValue placeholder={t("none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("none")}</SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
        {dirty && (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {tf("unsaved")}
          </span>
        )}
        <Button onClick={handleSave} disabled={saving || !dirty} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? tc("saving") : t("saveSettings")}
        </Button>
      </div>
    </div>
  )
}
