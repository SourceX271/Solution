"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send, Trash2, Pencil, Reply } from "lucide-react"
import { marked } from "marked"
import { formatRelativeTime } from "@/lib/utils"

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string
  } catch {
    return content
  }
}

interface CommentAuthor {
  id: string
  name: string | null
  image: string | null
}

interface CommentData {
  id: string
  content: string
  createdAt: string
  updatedAt?: string
  parentId?: string | null
  author: CommentAuthor
  replies?: CommentData[]
}

interface CommentSectionProps {
  targetType: string
  targetId: string
  userId: string | undefined
}

export function CommentSection({ targetType, targetId, userId }: CommentSectionProps) {
  const router = useRouter()
  const [comments, setComments] = useState<CommentData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch("/api/comments?targetType=" + targetType + "&targetId=" + targetId)
      if (res.ok) {
        const data = await res.json()
        const rawComments: CommentData[] = data.comments ?? data

        const topLevel: CommentData[] = []
        const repliesMap = new Map<string, CommentData[]>()
        for (const c of rawComments) {
          if (c.parentId) {
            const arr = repliesMap.get(c.parentId) || []
            arr.push(c)
            repliesMap.set(c.parentId, arr)
          } else {
            topLevel.push(c)
          }
        }

        const attachReplies = (list: CommentData[]) => {
          for (const c of list) {
            c.replies = repliesMap.get(c.id) || []
            if (c.replies.length > 0) attachReplies(c.replies)
          }
        }
        attachReplies(topLevel)
        setComments(topLevel)
        setTotalCount(rawComments.length)
      }
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault()
    if (!userId) { router.push("/login"); return }
    const text = parentId ? replyContent.trim() : content.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const body: Record<string, string> = { targetType, targetId, content: text }
      if (parentId) body.parentId = parentId
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        if (parentId) { setReplyContent(""); setReplyingTo(null) }
        else setContent("")
        fetchComments()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch("/api/comments/" + commentId, { method: "DELETE" })
      if (res.ok) fetchComments()
    } catch {}
  }

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return
    try {
      const res = await fetch("/api/comments/" + commentId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      if (res.ok) { setEditingId(null); setEditContent(""); fetchComments() }
    } catch {}
  }

  const renderComment = (comment: CommentData, depth: number = 0) => {
    const isEditing = editingId === comment.id
    const isReplying = replyingTo === comment.id
    const canEdit = userId === comment.author.id

    return (
      <div key={comment.id} className={depth > 0 ? "ml-6 mt-2" : ""}>
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{comment.author.name ?? "Anonymous"}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {canEdit && !isEditing && (
                <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content) }} className="text-muted-foreground hover:text-foreground" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canEdit && (
                <button onClick={() => handleDelete(comment.id)} className="text-muted-foreground hover:text-destructive" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div>
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px]" rows={3} />
              <div className="mt-2 flex gap-2">
                <button onClick={() => handleSaveEdit(comment.id)} disabled={!editContent.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Save</button>
                <button onClick={() => { setEditingId(null); setEditContent("") }} className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="prose-custom max-w-none text-sm [&_pre]:bg-transparent [&_pre]:p-0 [&_pre_code]:text-xs" dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.content) }} />
          )}

          {!isEditing && userId && depth < 3 && (
            <button onClick={() => { setReplyingTo(isReplying ? null : comment.id); setReplyContent("") }} className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Reply className="h-3 w-3" />
              {isReplying ? "Cancel" : "Reply"}
            </button>
          )}

          {isReplying && (
            <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-2">
              <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder={"Reply to " + (comment.author.name ?? "Anonymous") + "..."} className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px]" rows={2} />
              <div className="mt-2 flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">Markdown: **bold** `code` [link](url)</span>
                <button type="submit" disabled={!replyContent.trim() || submitting} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Send className="h-3 w-3" />
                  {submitting ? "..." : "Reply"}
                </button>
              </div>
            </form>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="border-l-2 border-muted ml-3 pl-3 mt-1 space-y-1">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Comments ({totalCount})</h3>

      <form onSubmit={(e) => handleSubmit(e)} className="mb-6">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={userId ? "Write a comment... (Markdown supported)" : "Login to comment"} className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[80px]" rows={3} />
        {userId && (
          <div className="mt-2 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Markdown: **bold** `code` [link](url)</span>
            <button type="submit" disabled={!content.trim() || submitting} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Send className="h-3 w-3" />
              {submitting ? "..." : "Post"}
            </button>
          </div>
        )}
      </form>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : comments.length > 0 ? (
        <div className="space-y-2">{comments.map((comment) => renderComment(comment))}</div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">No comments yet</p>
      )}
    </div>
  )
}