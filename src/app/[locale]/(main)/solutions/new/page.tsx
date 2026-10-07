"use client"

import { useCallback, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { Send } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { PUBLISH_LIMITS, PUBLISH_MIN, hasRichTextContent, plainTextLength } from "@/lib/publish"

interface FormState {
  title: string
  problem: string
  category: string
  tags: string[]
  excerpt: string
  content: string
}

const EMPTY_FORM: FormState = {
  title: "",
  problem: "",
  category: "solution",
  tags: [],
  excerpt: "",
  content: "",
}

type FieldName = "title" | "content" | "problem" | "excerpt"

export default function NewSolutionPage() {
  const t = useTranslations("docs")
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
    `publish:solution:${session?.user?.id ?? "anon"}`,
    form,
    { enabled: !!session }
  )

  const categories = useMemo(
    () => [
      { value: "solution", label: t("categorySolution") },
      { value: "tutorial", label: t("categoryTutorial") },
      { value: "guide", label: t("categoryGuide") },
      { value: "reference", label: t("categoryReference") },
      { value: "news", label: t("categoryNews") },
    ],
    [t]
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key as FieldName] ? { ...current, [key]: undefined } : current))
  }

  const validate = useCallback((): Partial<Record<FieldName, string>> => {
    const next: Partial<Record<FieldName, string>> = {}
    if (form.title.trim().length < PUBLISH_MIN.solutionTitle) next.title = tv("titleMin2")
    if (!hasRichTextContent(form.content, PUBLISH_MIN.solutionContent)) next.content = tv("contentMin10")
    if (form.problem.length > PUBLISH_LIMITS.solutionProblem) next.problem = tv("problemMax2000")
    return next
  }, [form, tv])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setError(tp("fixErrors"))
      document.getElementById(nextErrors.title ? "title" : "content")?.focus()
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content,
          excerpt: form.excerpt.trim() || undefined,
          problem: form.problem.trim() || undefined,
          category: form.category,
          tags: form.tags,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || tc("publishFailed"))
      draft.clear()
      toast.success(tp("publishedToast"))
      router.push(`/solutions/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("publishFailedRetry"))
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") return <PublishLoading />
  if (!session) return <PublishLoginRequired message={tc("loginRequiredDocs")} />

  const prompt = draft.pendingDraft

  return (
    <PublishShell
      title={t("publishTitle")}
      description={t("publishSubtitle")}
      backHref="/solutions"
      backLabel={t("backToList")}
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
          items={[tp("tipSolution1"), tp("tipSolution2"), tp("tipSolution3")]}
        />
      }
      actions={
        <SubmitButton
          pending={saving}
          label={t("publish")}
          pendingLabel={tc("publishing")}
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
        id="title"
        label={tc("titleLabel")}
        required
        hint={t("titleHint")}
        counter={`${form.title.length}/${PUBLISH_LIMITS.solutionTitle}`}
        error={errors.title}
      >
        <Input
          type="text"
          value={form.title}
          onChange={(event) => update("title", event.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={PUBLISH_LIMITS.solutionTitle}
          autoFocus
        />
      </Field>

      <Field id="problem" label={t("problemTitle")} hint={t("problemHint")} error={errors.problem}>
        <Input
          type="text"
          value={form.problem}
          onChange={(event) => update("problem", event.target.value)}
          placeholder={t("problemPlaceholder")}
          maxLength={PUBLISH_LIMITS.solutionProblem}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field id="tags" label={tc("tags")}>
          <TagPicker
            id="tags"
            value={form.tags}
            onChange={(next) => update("tags", next)}
            placeholder={tc("tagsPlaceholder")}
          />
        </Field>
      </div>

      <Field
        id="excerpt"
        label={tc("excerpt")}
        hint={t("excerptHint")}
        counter={`${form.excerpt.length}/${PUBLISH_LIMITS.solutionExcerpt}`}
        error={errors.excerpt}
      >
        <Textarea
          value={form.excerpt}
          onChange={(event) => update("excerpt", event.target.value)}
          placeholder={t("excerptPlaceholder")}
          maxLength={PUBLISH_LIMITS.solutionExcerpt}
          rows={2}
        />
      </Field>

      <Field
        id="content"
        label={tc("content")}
        required
        hint={t("contentHint", { count: plainTextLength(form.content) })}
        error={errors.content}
      >
        <RichEditor
          id="content"
          labelledBy="content-label"
          describedBy={errors.content ? "content-error" : "content-hint"}
          invalid={!!errors.content}
          value={form.content}
          onChange={(html) => update("content", html)}
          placeholder={t("contentPlaceholder")}
          minHeight="320px"
        />
      </Field>
    </PublishShell>
  )
}
