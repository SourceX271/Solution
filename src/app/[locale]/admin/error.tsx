"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Error boundary for the admin area. Without it a failed query inside one page
 * (a deleted row, a database hiccup) replaced the whole panel with Next's
 * default error screen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("admin.errorUi")

  useEffect(() => {
    console.error("Admin panel error:", error)
  }, [error])

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {error.digest && (
          <code className="block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {t("reference")}: {error.digest}
          </code>
        )}
        <Button onClick={reset} size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          {t("retry")}
        </Button>
      </CardContent>
    </Card>
  )
}
