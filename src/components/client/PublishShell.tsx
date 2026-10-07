"use client"

import * as React from "react"
import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import {
  AlertCircle, ArrowLeft, Info, Loader2, RotateCcw, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Shared chrome for the three publishing pages (solution / question / software).
 *
 * Before this file each page rolled its own markup: three different container
 * widths, three button styles, labels without `htmlFor`, no `<form>` element
 * (so Enter did not submit) and no field-level error display. Everything that
 * is common now lives here so the pages only describe their own fields.
 */

/* ------------------------------------------------------------------ Field -- */

interface FieldProps {
  id: string
  label: string
  required?: boolean
  /** Helper text shown under the control when there is no error. */
  hint?: string
  /** Pre-formatted counter such as "12/200". */
  counter?: string
  error?: string
  children: React.ReactNode
}

interface ClonableControlProps {
  id?: string
  required?: boolean
  "aria-invalid"?: true
  "aria-describedby"?: string
  "aria-labelledby"?: string
}

/**
 * Label + control + hint/error with the aria wiring done once.
 * The control receives `id`, `aria-invalid` and `aria-describedby` via
 * `cloneElement`, so pages cannot forget to connect them.
 */
export function Field({ id, label, required, hint, counter, error, children }: FieldProps) {
  const requiredMark = useTranslations("common")("requiredMark")
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const control = React.isValidElement<ClonableControlProps>(children)
    ? React.cloneElement(children, {
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-labelledby": `${id}-label`,
      })
    : children

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              {requiredMark}
            </span>
          )}
        </Label>
        {counter && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{counter}</span>
        )}
      </div>
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ----------------------------------------------------------- Draft banner -- */

export function DraftBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void
  onDiscard: () => void
}) {
  const t = useTranslations("publish")
  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <RotateCcw className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t("draftFound")}</span>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" onClick={onRestore}>
          {t("draftRestore")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("draftDiscard")}
        </Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Tips ---- */

export function TipsCard({ title, items }: { title: string; items: string[] }) {
  return (
    <aside className="rounded-2xl border bg-muted/30 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Info className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </h2>
      <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/* --------------------------------------------------------------- Shell ---- */

interface PublishShellProps {
  title: string
  description: string
  backHref: string
  backLabel: string
  /** Page-level error, shown in one alert above the form. */
  error?: string | null
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  children: React.ReactNode
  /** Right column: tips, preview, anything supplementary. */
  aside?: React.ReactNode
  /** Submit buttons. */
  actions: React.ReactNode
  /** Small print under the actions (autosave state, shortcuts). */
  footnote?: React.ReactNode
  notice?: React.ReactNode
}

export function PublishShell({
  title,
  description,
  backHref,
  backLabel,
  error,
  onSubmit,
  children,
  aside,
  actions,
  footnote,
  notice,
}: PublishShellProps) {
  const t = useTranslations("publish")

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    // Ctrl/⌘ + Enter submits from anywhere in the form, including the editor.
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.requestSubmit()
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 animate-fade-in sm:py-10">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold gradient-text">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </header>

      {notice}

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        onKeyDown={handleKeyDown}
        noValidate
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start"
      >
        <div className="min-w-0 space-y-5">{children}</div>

        <div className="space-y-4 lg:sticky lg:top-24">
          {aside}
          <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
            {actions}
            <p className="text-[11px] leading-relaxed text-muted-foreground">{t("shortcutHint")}</p>
            {footnote}
          </div>
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------ Gateways ---- */

export function PublishLoading() {
  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
    </div>
  )
}

export function PublishLoginRequired({ message, className }: { message: string; className?: string }) {
  const tc = useTranslations("common")
  return (
    <div className={cn("container mx-auto px-4 py-20 text-center animate-fade-in", className)}>
      <h1 className="mb-4 text-2xl font-bold gradient-text">{tc("loginRequiredTitle")}</h1>
      <p className="mb-6 text-muted-foreground">{message}</p>
      <Link
        href="/login"
        className="btn-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25"
      >
        {tc("goToLogin")}
      </Link>
    </div>
  )
}

/**
 * Submit button with a built-in pending state, so all three forms match.
 * The primary variant keeps the site's `btn-gradient` call to action (a plain
 * `<button>` because the `ui/button` background utility would win over the
 * gradient class).
 */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
  variant = "default",
  icon,
}: {
  pending: boolean
  label: string
  pendingLabel: string
  variant?: "default" | "outline"
  icon?: React.ReactNode
}) {
  if (variant === "outline") {
    return (
      <Button type="submit" variant="outline" disabled={pending} className="w-full justify-center">
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
        {pending ? pendingLabel : label}
      </Button>
    )
  }

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gradient inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:shadow-none"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {pending ? pendingLabel : label}
    </button>
  )
}
