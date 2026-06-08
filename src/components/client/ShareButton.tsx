"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"

interface ShareButtonProps {
  title: string
}

export function ShareButton({ title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: do nothing
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
          已复制
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          分享
        </>
      )}
    </button>
  )
}