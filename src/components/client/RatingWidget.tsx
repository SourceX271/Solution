"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface RatingWidgetProps {
  softwareId: string
  currentRating: number
  userId: string | undefined
}

export function RatingWidget({ softwareId, currentRating, userId }: RatingWidgetProps) {
  const router = useRouter()
  const [rating, setRating] = useState(currentRating)
  const [hover, setHover] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleRate = async (value: number) => {
    if (!userId) {
      router.push("/login")
      return
    }
    if (loading) return

    setLoading(true)
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "software",
          targetId: softwareId,
          value,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.voted === false) {
          setRating(0)
          toast.success(data.message || "已取消评分")
        } else {
          setRating(value)
          toast.success(data.message || "评分成功")
        }
        router.refresh()
      } else {
        toast.error(data.error || "评分失败")
      }
    } catch {
      toast.error("评分操作失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={loading}
          onClick={() => handleRate(star)}
          onMouseEnter={() => !loading && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 disabled:cursor-default"
          aria-label={`Rate ${star} stars`}
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              (hover || rating) >= star
                ? "fill-yellow-500 text-yellow-500"
                : "text-muted-foreground hover:text-yellow-400"
            )}
          />
        </button>
      ))}
      {!userId && (
        <span className="ml-2 text-xs text-muted-foreground">登录即可评分</span>
      )}
      {loading && (
        <span className="ml-2 text-xs text-muted-foreground animate-pulse">提交中...</span>
      )}
    </div>
  )
}
