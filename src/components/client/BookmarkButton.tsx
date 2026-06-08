"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"

interface BookmarkButtonProps {
  targetType: string
  targetId: string
  isBookmarked: boolean
}

export function BookmarkButton({ targetType, targetId, isBookmarked: initial }: BookmarkButtonProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [bookmarked, setBookmarked] = useState(initial)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!session) {
      router.push("/login")
      return
    }
    if (loading) return

    setLoading(true)
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      })
      if (res.ok) {
        setBookmarked((prev) => !prev)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm transition-colors hover:bg-accent",
        bookmarked && "text-primary"
      )}
    >
      <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      {bookmarked ? "已收藏" : "收藏"}
    </button>
  )
}