"use client"

import { useCallback, useState } from "react"
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
import { PUBLISH_LIMITS, PUBLISH_MIN, hasRichTextContent, plainTextLength } from "@/lib/publish"

interface FormState {
  title: string
  content: string
  tags: string[]
}

const EMPTY_FORM: FormState = { title: "", content: "", tags: [] }

type FieldName = "title" | "content"

export default function AskQuestionPage() {
  const t = useTranslations("questions")
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
    `publish:question:${session?.user?.id ?? "anon"}`,
    form,
    { enabled: !!session }
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key as FieldName] ? { ...current, [key]: undefined } : current))
  }

  const validate = useCallback((): Partial<Record<FieldName, string>> => {
    const next: Partial<Record<FieldName, string>> = {}
    if (form.title.trim().length < PUBLISH_MIN.questionTitle) next.title = tv("titleMin5")
    if (!hasRichTextContent(form.content, PUBLISH_MIN.questionContent)) next.content = tv("contentMin20")
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
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content,
          tags: form.tags,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || tc("publishFailed"))
      draft.clear()
      toast.success(tp("publishedToast"))
      router.push(`/questions/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("publishFailedRetry"))
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") return <PublishLoading />
  if (!session) return <PublishLoginRequired message={tc("loginRequiredQuestion")} />

  const prompt = draft.pendingDraft

  return (
    <PublishShell
      title={t("askTitle")}
      description={t("askSubtitle")}
      backHref="/questions"
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
          items={[tp("tipQuestion1"), tp("tipQuestion2"), tp("tipQuestion3")]}
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
        counter={`${form.title.length}/${PUBLISH_LIMITS.questionTitle}`}
        error={errors.title}
      >
        <Input
          type="text"
          value={form.title}
          onChange={(event) => update("title", event.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={PUBLISH_LIMITS.questionTitle}
          autoFocus
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
          minHeight="280px"
        />
      </Field>

      <Field id="tags" label={tc("tags")} hint={t("tagsHint")}>
        <TagPicker
          id="tags"
          value={form.tags}
          onChange={(next) => update("tags", next)}
          placeholder={tc("tagsPlaceholder")}
        />
      </Field>
    </PublishShell>
  )
}
