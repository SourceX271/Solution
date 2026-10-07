"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"
import { useTranslations } from "next-intl"

interface ShareButtonProps {
  title: string
}

export function ShareButton({ title }: ShareButtonProps) {
  const t = useTranslations("common")
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // Cancelling the sheet rejects with AbortError — that used to fall
        // through to the clipboard branch and show "copied" for a share the
        // user had explicitly dismissed.
        if ((error as DOMException)?.name === "AbortError") return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (insecure context, permission denied).
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm transition-colors hover:bg-accent"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          {t("copied")}
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          {t("share")}
        </>
      )}
    </button>
  )
}