"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoteButtonsProps {
  targetType: string
  targetId: string
  upVotes: number
  downVotes: number
  userVote: number | null
}

export function VoteButtons({ targetType, targetId, upVotes, downVotes, userVote: initialVote }: VoteButtonsProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [userVote, setUserVote] = useState<number | null>(initialVote)
  const [up, setUp] = useState(upVotes)
  const [down, setDown] = useState(downVotes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleVote = async (value: number) => {
    if (!session) {
      router.push("/login")
      return
    }
    if (loading) return

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, value }),
      })

      if (!res.ok) {
        setError("操作失败，请稍后重试")
        return
      }

      const data = await res.json()
      if (data.voted === false) {
        // Vote was removed
        setUserVote(null)
        if (value === 1) setUp((p) => p - 1)
        else setDown((p) => p - 1)
      } else {
        // Vote was added or changed
        if (userVote === 1) setUp((p) => p - 1)
        if (userVote === -1) setDown((p) => p - 1)
        setUserVote(value)
        if (value === 1) setUp((p) => p + 1)
        else setDown((p) => p + 1)
      }
    } catch {
      setError("网络异常，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleVote(1)}
        disabled={loading}
        aria-pressed={userVote === 1}
        aria-label={`赞同，当前 ${up} 票${userVote === 1 ? "（已赞同）" : ""}`}
        title="赞同"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent",
          userVote === 1 && "text-green-600"
        )}
      >
        <ThumbsUp className={cn("h-4 w-4", userVote === 1 && "fill-current")} aria-hidden="true" />
        <span>{up}</span>
      </button>
      <button
        type="button"
        onClick={() => handleVote(-1)}
        disabled={loading}
        aria-pressed={userVote === -1}
        aria-label={`反对，当前 ${down} 票${userVote === -1 ? "（已反对）" : ""}`}
        title="反对"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent",
          userVote === -1 && "text-red-600"
        )}
      >
        <ThumbsDown className={cn("h-4 w-4", userVote === -1 && "fill-current")} aria-hidden="true" />
        <span>{down}</span>
      </button>
      {error && (
        <span role="alert" className="ml-1 text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
