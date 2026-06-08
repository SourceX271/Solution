"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"

interface AcceptButtonProps {
  answerId: string
  questionId: string
}

export function AcceptButton({ answerId, questionId }: AcceptButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/answers/${answerId}/accept`, {
        method: "PUT",
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
      title="采纳此回答"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
    </button>
  )
}