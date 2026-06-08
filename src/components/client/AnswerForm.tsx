"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Loader2, Send } from "lucide-react"

interface AnswerFormProps {
  questionId: string
  userId: string | undefined
}

export function AnswerForm({ questionId, userId }: AnswerFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "写下你的回答..." }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] p-4 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring",
      },
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!userId) {
      router.push("/login")
      return
    }
    if (!editor || editor.isEmpty || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          content: editor.getHTML(),
        }),
      })
      if (res.ok) {
        editor.commands.clearContent()
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }, [userId, editor, questionId, router, submitting])

  if (!userId) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          请先登录后回答
        </p>
        <button
          onClick={() => router.push("/login")}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          去登录
        </button>
      </div>
    )
  }

  return (
    <div>
      <EditorContent editor={editor} />
      {editor && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-1 text-xs ${editor.isActive("bold") ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`rounded px-2 py-1 text-xs ${editor.isActive("codeBlock") ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}
          >
            {'<Code>'}
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rounded px-2 py-1 text-xs ${editor.isActive("bulletList") ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || editor.isEmpty}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
            <Send className="h-3 w-3" />
            {submitting ? "提交中..." : "提交回答"}
          </button>
        </div>
      )}
      {success && (
        <p className="mt-2 text-sm text-green-600">回答发布成功！</p>
      )}
    </div>
  )
}
