"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"
import { useTranslations } from "next-intl"

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors")
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-20 text-center animate-fade-in">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 mb-6">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="mb-2 text-2xl font-bold gradient-text">{t("title")}</h1>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        {error.message || t("fallback")}
      </p>
      <button
        onClick={reset}
        className="btn-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25"
      >
        <RotateCw className="h-4 w-4" />
        {t("retry")}
      </button>
    </div>
  )
}
