"use client"

import { RichEditor } from "@/components/client/RichEditor"

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  return (
    <RichEditor
      value={content}
      onChange={onChange}
      placeholder="Write something..."
      minHeight="300px"
    />
  )
}