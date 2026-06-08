"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import LinkExtension from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, List, ListOrdered, Quote, Code, Undo, Redo, Link as LinkIcon, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCallback } from "react"

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write something..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  const addImage = useCallback(() => {
    const url = window.prompt("Image URL")
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const addLink = useCallback(() => {
    const url = window.prompt("Link URL")
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) {
    return <div className="h-40 rounded-md border bg-muted animate-pulse" />
  }

  const ToolbarButton = ({
    onClick, active, disabled, children,
  }: {
    onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded p-1.5 text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "opacity-30"
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/50 px-2 py-1.5">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={addLink} active={editor.isActive("link")}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={addImage}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none"
      />
    </div>
  )
}