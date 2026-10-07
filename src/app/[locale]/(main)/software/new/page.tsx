"use client"

import { useCallback, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { Send } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { RichEditor } from "@/components/client/RichEditor"
import { TagPicker } from "@/components/client/TagPicker"
import {
  DraftBanner,
  Field,
  PublishLoading,
  PublishLoginRequired,
  PublishShell,
  SubmitButton,
  TipsCard,
} from "@/components/client/PublishShell"
import { usePublishDraft } from "@/components/client/usePublishDraft"
import {
  PUBLISH_LIMITS,
  PUBLISH_MIN,
  hasRichTextContent,
  isValidHttpUrl,
  plainTextLength,
} from "@/lib/publish"

interface FormState {
  name: string
  description: string
  url: string
  category: string
  tags: string[]
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  url: "",
  category: "tool",
  tags: [],
}

type FieldName = "name" | "description" | "url"

export default function NewSoftwarePage() {
  const t = useTranslations("software")
  const tc = useTranslations("common")
  const tp = useTranslations("publish")
  const tv = useTranslations("validation")
  const router = useRouter()
  const { data: session, status } = useSession()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const draft = usePublishDraft<FormState>(
    `publish:software:${session?.user?.id ?? "anon"}`,
    form,
    { enabled: !!session }
  )

  const categories = useMemo(
    () => [
      { value: "tool", label: t("categoryTool") },
      { value: "development", label: t("categoryDevelopment") },
      { value: "website", label: t("categoryWebsite") },
      { value: "game", label: t("categoryGame") },
      { value: "library", label: t("categoryLibrary") },
      { value: "other", label: t("categoryOther") },
    ],
    [t]
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key as FieldName] ? { ...current, [key]: undefined } : current))
  }

  const validate = useCallback((): Partial<Record<FieldName, string>> => {
    const next: Partial<Record<FieldName, string>> = {}
    if (!form.name.trim()) next.name = tv("nameRequired")
    if (!hasRichTextContent(form.description, PUBLISH_MIN.softwareDescription)) {
      next.description = tv("descriptionMin10")
    }
    const url = form.url.trim()
    if (url && !isValidHttpUrl(url)) next.url = tv("urlInvalid")
    return next
  }, [form, tv])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setError(tp("fixErrors"))
      // Focus the first invalid control in DOM order.
      const firstInvalid = (["name", "url", "description"] as FieldName[]).find((key) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/software", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description,
          url: form.url.trim() || undefined,
          category: form.category,
          tags: form.tags,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || tc("submitFailed"))
      draft.clear()
      toast.success(tp("publishedToast"))
      router.push(`/software/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("submitFailedRetry"))
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") return <PublishLoading />
  if (!session) return <PublishLoginRequired message={tc("loginRequiredSoftware")} />

  const prompt = draft.pendingDraft

  return (
    <PublishShell
      title={t("submitTitle")}
      description={t("submitSubtitle")}
      backHref="/software"
      backLabel={tc("back")}
      error={error}
      onSubmit={handleSubmit}
      notice={
        prompt ? (
          <DraftBanner
            onRestore={() => {
              const restored = draft.restore()
              if (restored) setForm(restored)
            }}
            onDiscard={draft.discard}
          />
        ) : null
      }
      aside={
        <TipsCard
          title={tp("tipsTitle")}
          items={[tp("tipSoftware1"), tp("tipSoftware2"), tp("tipSoftware3")]}
        />
      }
      actions={
        <SubmitButton
          pending={saving}
          label={t("submit")}
          pendingLabel={tc("submitting")}
          icon={<Send className="mr-2 h-4 w-4" aria-hidden="true" />}
        />
      }
      footnote={
        draft.savedAt ? (
          <p className="text-[11px] text-muted-foreground">
            {tp("draftSavedAt", { time: new Date(draft.savedAt).toLocaleTimeString() })}
          </p>
        ) : null
      }
    >
      <Field
        id="name"
        label={tc("name")}
        required
        hint={t("nameHint")}
        counter={`${form.name.length}/${PUBLISH_LIMITS.softwareName}`}
        error={errors.name}
      >
        <Input
          type="text"
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={PUBLISH_LIMITS.softwareName}
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="url" label={t("urlLabel")} hint={t("urlHint")} error={errors.url}>
          <Input
            type="url"
            value={form.url}
            onChange={(event) => update("url", event.target.value)}
            placeholder={t("urlPlaceholder")}
            maxLength={PUBLISH_LIMITS.softwareUrl}
            inputMode="url"
          />
        </Field>

        <Field id="category" label={tc("category")}>
          <select
            id="category"
            value={form.category}
            onChange={(event) => update("category", event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        id="description"
        label={tc("description")}
        required
        hint={t("descriptionHint", { count: plainTextLength(form.description) })}
        error={errors.description}
      >
        <RichEditor
          id="description"
          labelledBy="description-label"
          describedBy={errors.description ? "description-error" : "description-hint"}
          invalid={!!errors.description}
          value={form.description}
          onChange={(html) => update("description", html)}
          placeholder={t("descriptionPlaceholder")}
          minHeight="220px"
        />
      </Field>

      <Field id="tags" label={tc("tags")} hint={t("tagsHint")}>
        <TagPicker
          id="tags"
          value={form.tags}
          onChange={(next) => update("tags", next)}
          placeholder={t("tagsPlaceholder")}
        />
      </Field>
    </PublishShell>
  )
}
