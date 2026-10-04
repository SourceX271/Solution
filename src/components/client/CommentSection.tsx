"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Loader2, Send, Trash2, Pencil, Reply, Eye, EyeOff, Bold, Italic, Code, Link, Quote } from "lucide-react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { formatRelativeTime } from "@/lib/utils"

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(content: string): string {
  if (!content) return ""
  try {
    const raw = marked.parse(content) as string
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "s", "a", "code", "pre", "ul", "ol", "li", "blockquote", "img", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "input"],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class", "type", "checked", "disabled"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:|\/|#)/i,
    })
  } catch {
    return content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }
}

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  wrapper: string,
  placeholder: string
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.substring(start, end) || placeholder
  const before = textarea.value.substring(0, start)
  const after = textarea.value.substring(end)
  const inserted = wrapper.replace("$1", selected)
  textarea.value = before + inserted + after
  textarea.focus()
  const newPos = start + inserted.length - (selected !== placeholder ? 0 : placeholder.length)
  textarea.setSelectionRange(newPos, newPos + (selected !== placeholder ? selected.length : placeholder.length))
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

const MD_SYNTAX_META = [
  { label: "B", icon: Bold, wrapper: "**$1**", placeholderKey: "boldPlaceholder" },
  { label: "I", icon: Italic, wrapper: "*$1*", placeholderKey: "italicPlaceholder" },
  { label: "`", icon: Code, wrapper: "`$1`", placeholderKey: "codePlaceholder" },
  { label: "[]", icon: Link, wrapper: "[$1](url)", placeholderKey: "linkPlaceholder" },
  { label: '"', icon: Quote, wrapper: "> $1", placeholderKey: "quotePlaceholder" },
]

export function CommentSection({ targetType, targetId, userId }: CommentSectionProps) {
  const t = useTranslations("comments")
  const tc = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const [comments, setComments] = useState<CommentData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [content, setContent] = useState("")
  const [previewContent, setPreviewContent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editPreview, setEditPreview] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [replyPreview, setReplyPreview] = useState(false)
  const [error, setError] = useState("")

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const MD_SYNTAX = MD_SYNTAX_META.map((s) => ({ ...s, placeholder: t(s.placeholderKey) }))

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
      } else {
        setError(t("loadFailed"))
      }
    } catch {
      setError(t("loadFailedNetwork"))
    } finally { setLoading(false) }
    // `t` must stay out of the deps: useTranslations returns a new function on
    // every render, and this callback feeds the effect below — depending on it
    // would refetch comments in an endless loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleSubmit = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault()
    if (!userId) { router.push("/login"); return }
    const text = parentId ? replyContent.trim() : content.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setError("")
    try {
      const body: Record<string, string> = { targetType, targetId, content: text }
      if (parentId) body.parentId = parentId
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        if (parentId) { setReplyContent(""); setReplyingTo(null); setReplyPreview(false) }
        else { setContent(""); setPreviewContent(false) }
        fetchComments()
      } else {
        // Surface why it failed instead of silently doing nothing.
        const data = await res.json().catch(() => null)
        setError(data?.error || t("sendFailed"))
      }
    } catch {
      setError(t("sendFailedNetwork"))
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (commentId: string) => {
    if (!window.confirm(t("deleteConfirm"))) return
    try {
      const res = await fetch("/api/comments/" + commentId, { method: "DELETE" })
      if (!res.ok) {
        setError(t("deleteFailed"))
        return
      }
      fetchComments()
    } catch {
      setError(t("deleteFailedNetwork"))
    }
  }

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return
    try {
      const res = await fetch("/api/comments/" + commentId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      if (res.ok) {
        setEditingId(null); setEditContent(""); setEditPreview(false); fetchComments()
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || t("saveFailed"))
      }
    } catch {
      setError(t("saveFailedNetwork"))
    }
  }

  const insertMD = (ref: React.RefObject<HTMLTextAreaElement | null>, syntax: typeof MD_SYNTAX[number]) => {
    const el = ref.current
    if (!el) return
    insertMarkdown(el, syntax.wrapper, syntax.placeholder)
    // Trigger React state update by dispatching an input event
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    )?.set
    nativeInputValueSetter?.call(el, el.value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }

  const MdToolbar = ({ textareaRef }: { textareaRef: React.RefObject<HTMLTextAreaElement | null> }) => (
    <div className="flex flex-wrap gap-0.5 mb-1.5">
      {MD_SYNTAX.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => insertMD(textareaRef, s)}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={s.placeholder}
        >
          <s.icon className="h-3 w-3" />
        </button>
      ))}
    </div>
  )

  const renderComment = (comment: CommentData, depth: number = 0) => {
    const isEditing = editingId === comment.id
    const isReplying = replyingTo === comment.id
    const canEdit = userId === comment.author.id

    return (
      <div key={comment.id} className={depth > 0 ? "ml-6 mt-2" : ""}>
        <div className="rounded-lg border p-3 hover:border-muted-foreground/30 transition-colors">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{comment.author.name ?? t("anonymous")}</span>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt, locale)}</span>
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-muted-foreground">({t("edited")})</span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {canEdit && !isEditing && (
                <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); setEditPreview(false) }} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title={tc("edit")}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canEdit && (
                <button onClick={() => handleDelete(comment.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title={tc("delete")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <MdToolbar textareaRef={editTextareaRef} />
              {editPreview ? (
                <div
                  className="prose-custom max-w-none min-h-[60px] rounded-md border bg-muted/30 p-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) }}
                />
              ) : (
                <textarea
                  ref={editTextareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-md border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px]"
                  rows={3}
                  placeholder={t("editComment")}
                />
              )}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setEditPreview(!editPreview)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  {editPreview ? <><EyeOff className="h-3 w-3" />{tc("edit")}</> : <><Eye className="h-3 w-3" />{tc("preview")}</>}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(null); setEditContent(""); setEditPreview(false) }} className="rounded-md border px-3 py-1 text-xs hover:bg-accent transition-colors">{tc("cancel")}</button>
                  <button onClick={() => handleSaveEdit(comment.id)} disabled={!editContent.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{tc("save")}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="prose-custom max-w-none text-sm [&_pre]:bg-gray-950 [&_pre]:text-gray-100 [&_pre]:p-3 [&_pre]:rounded [&_pre_code]:text-xs [&_pre_code]:bg-transparent [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline" dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.content) }} />
          )}

          {!isEditing && userId && depth < 3 && (
            <button onClick={() => { setReplyingTo(isReplying ? null : comment.id); setReplyContent(""); setReplyPreview(false) }} className="mt-2.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Reply className="h-3 w-3" />
              {isReplying ? t("cancelReply") : t("reply")}
            </button>
          )}

          {isReplying && (
            <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-2.5 ml-2 border-l-2 border-muted pl-3 space-y-2">
              <MdToolbar textareaRef={replyTextareaRef} />
              {replyPreview ? (
                <div
                  className="prose-custom max-w-none min-h-[50px] rounded-md border bg-muted/30 p-2.5 text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(replyContent) }}
                />
              ) : (
                <textarea
                  ref={replyTextareaRef}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={t("replyPlaceholder", { name: comment.author.name ?? t("anonymous") })}
                  className="w-full rounded-md border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[60px]"
                  rows={2}
                />
              )}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setReplyPreview(!replyPreview)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                  {replyPreview ? <><EyeOff className="h-3 w-3" />{tc("edit")}</> : <><Eye className="h-3 w-3" />{tc("preview")}</>}
                </button>
                <button type="submit" disabled={!replyContent.trim() || submitting} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  <Send className="h-3 w-3" />
                  {submitting ? t("posting") : t("reply")}
                </button>
              </div>
            </form>
          )}
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="border-l-2 border-muted ml-3 pl-3 mt-1.5 space-y-1.5">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">{tc("commentCountLabel", { count: totalCount })}</h3>

      <form onSubmit={(e) => handleSubmit(e)} className="mb-6">
        {userId && <MdToolbar textareaRef={textareaRef} />}
        {previewContent ? (
          <div
            className="prose-custom max-w-none min-h-[80px] rounded-md border bg-muted/30 p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={userId ? t("placeholder") : t("placeholderLogin")}
            className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[80px]"
            rows={3}
          />
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {userId && (
              <button type="button" onClick={() => setPreviewContent(!previewContent)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                {previewContent ? <><EyeOff className="h-3 w-3" />{tc("edit")}</> : <><Eye className="h-3 w-3" />{tc("preview")}</>}
              </button>
            )}
            <span className="text-[10px] text-muted-foreground hidden sm:inline">{t("markdownHint")}</span>
          </div>
          <button type="submit" disabled={!content.trim() || submitting} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Send className="h-3 w-3" />
            {submitting ? t("posting") : t("postComment")}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>
        )}
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : comments.length > 0 ? (
        <div className="space-y-2">{comments.map((comment) => renderComment(comment))}</div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noComments")}</p>
      )}
    </div>
  )
}