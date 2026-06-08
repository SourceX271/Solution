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

  const handleVote = async (value: number) => {
    if (!session) {
      router.push("/login")
      return
    }
    if (loading) return

    setLoading(true)
    try {
      const sameVote = userVote === value
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          value: sameVote ? 0 : value,
        }),
      })

      if (res.ok) {
        if (sameVote) {
          setUserVote(null)
          if (value === 1) setUp((p) => p - 1)
          else setDown((p) => p - 1)
        } else {
          if (userVote === 1) setUp((p) => p - 1)
          if (userVote === -1) setDown((p) => p - 1)
          setUserVote(value)
          if (value === 1) setUp((p) => p + 1)
          else setDown((p) => p + 1)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent",
          userVote === 1 && "text-green-600"
        )}
      >
        <ThumbsUp className="h-4 w-4" />
        <span>{up}</span>
      </button>
      <button
        onClick={() => handleVote(-1)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent",
          userVote === -1 && "text-red-600"
        )}
      >
        <ThumbsDown className="h-4 w-4" />
        <span>{down}</span>
      </button>
    </div>
  )
}