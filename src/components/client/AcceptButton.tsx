"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { readErrorMessage } from "@/lib/http-error"

interface AcceptButtonProps {
  answerId: string
  questionId: string
}

export function AcceptButton({ answerId, questionId }: AcceptButtonProps) {
  const t = useTranslations("common")
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/answers/${answerId}`, {
        method: "PATCH",
      })
      if (res.ok) {
        router.refresh()
      } else {
        // Only the asker may accept (403) and the answer may be gone (404):
        // failing silently left the button looking broken.
        toast.error(await readErrorMessage(res, t("submitFailedRetry")))
      }
    } catch {
      toast.error(t("networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      aria-label={t("acceptAnswer")}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
      title={t("acceptAnswer")}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
    </button>
  )
}
