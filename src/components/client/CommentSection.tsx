"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Send, Trash2 } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

interface Comment {
  id: string
  content: string
  createdAt: string
  author: {
    id: string
    name: string | null
    image: string | null
  }
}

interface CommentSectionProps {
  targetType: string
  targetId: string
  userId: string | undefined
}

export function CommentSection({ targetType, targetId, userId }: CommentSectionProps) {
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comments?targetType=${targetType}&targetId=${targetId}`
      )
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments ?? data)
      }
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) {
      router.push("/login")
      return
    }
    if (!content.trim() || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, content: content.trim() }),
      })
      if (res.ok) {
        setContent("")
        fetchComments()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" })
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    } catch {}
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">
        评论 ({comments.length})
      </h3>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={userId ? "写下你的评论..." : "请登录后发表评论"}
          className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[80px]"
          rows={3}
        />
        {userId && (
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              {submitting ? "发送中..." : "发表评论"}
            </button>
          </div>
        )}
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.author.name ?? "匿名用户"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                {userId === comment.author.id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm leading-relaxed">{comment.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          暂无评论，来发表第一条评论吧
        </p>
      )}
    </div>
  )
}