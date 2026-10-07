"use client"

import type { Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  Bold, Braces, Brackets, ChevronDown, Code, Columns, Eraser, Heading, Image as ImageIcon,
  Italic, Link as LinkIcon, List, ListOrdered, Minus, Pencil, Quote, Radical, Redo2, Sigma,
  Strikethrough, Underline, Undo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** What the editor is editing *in*: rich text, Markdown/HTML source, or split. */
export type EditorView = "wysiwyg" | "markdown" | "html" | "split"

interface EditorToolbarProps {
  editor: Editor
  view: EditorView
  onSelectView: (view: EditorView) => void
  onInsertLink: () => void
  onInsertImage: () => void
  onInsertMath: (displayMode: boolean) => void
}

/**
 * Editor toolbar.
 *
 * Previously a flat row of ~15 unlabelled icons where the mode switchers were
 * mixed in with the formatting buttons. Now: labelled groups (`role="group"`),
 * a block-type dropdown instead of a single hard-coded H2, the missing standard
 * commands (underline, inline code, horizontal rule, clear formatting), and a
 * segmented view switcher that folds the old "mode + format" pair into one
 * control.
 */
export function EditorToolbar({
  editor,
  view,
  onSelectView,
  onInsertLink,
  onInsertImage,
  onInsertMath,
}: EditorToolbarProps) {
  const t = useTranslations("editor")
  const isRichText = view === "wysiwyg"

  const headings = [
    { level: 1 as const, label: t("heading1") },
    { level: 2 as const, label: t("heading2") },
    { level: 3 as const, label: t("heading3") },
  ]

  const activeHeading = headings.find(({ level }) => editor.isActive("heading", { level }))
  const blockLabel = activeHeading ? `H${activeHeading.level}` : t("paragraph")

  const views: { value: EditorView; label: string; Icon: typeof Pencil }[] = [
    { value: "wysiwyg", label: t("richTextMode"), Icon: Pencil },
    { value: "markdown", label: t("markdownSource"), Icon: Code },
    { value: "html", label: t("htmlSource"), Icon: Brackets },
    { value: "split", label: t("splitPreview"), Icon: Columns },
  ]

  return (
    <div className="flex items-center gap-2 rounded-t-md border border-input border-b-0 bg-muted/40 p-1.5">
      {/* Formatting groups wrap inside their own column so the view switcher
          stays anchored to the right edge instead of drifting onto a second row. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {isRichText && (
          <>
            <ToolGroup label={t("groupText")}>
            <ToolButton
              label={t("bold")}
              shortcut={t("shortcutBold")}
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("italic")}
              shortcut={t("shortcutItalic")}
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("underline")}
              shortcut={t("shortcutUnderline")}
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("strike")}
              shortcut={t("shortcutStrike")}
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("inlineCode")}
              shortcut={t("shortcutInlineCode")}
              active={editor.isActive("code")}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code className="h-3.5 w-3.5" />
            </ToolButton>
          </ToolGroup>

          <Divider />

          <ToolGroup label={t("groupBlock")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("blockType")}
                  title={t("blockType")}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <Heading className="h-3.5 w-3.5" />
                  <span className="w-8 text-left">{blockLabel}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem
                  onSelect={() => editor.chain().focus().setParagraph().run()}
                  className={cn(!activeHeading && "font-medium text-primary")}
                >
                  {t("paragraph")}
                </DropdownMenuItem>
                {headings.map(({ level, label }) => (
                  <DropdownMenuItem
                    key={level}
                    onSelect={() => editor.chain().focus().toggleHeading({ level }).run()}
                    className={cn(activeHeading?.level === level && "font-medium text-primary")}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolButton
              label={t("bulletList")}
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("orderedList")}
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("blockquote")}
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("codeBlock")}
              active={editor.isActive("codeBlock")}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <Braces className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label={t("horizontalRule")} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <Minus className="h-3.5 w-3.5" />
            </ToolButton>
          </ToolGroup>

          <Divider />

          <ToolGroup label={t("groupInsert")}>
            <ToolButton
              label={t("insertLink")}
              active={editor.isActive("link")}
              onClick={onInsertLink}
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label={t("insertImage")} onClick={onInsertImage}>
              <ImageIcon className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={`${t("inlineMath")} ($…$)`}
              active={editor.isActive("mathInline")}
              onClick={() => onInsertMath(false)}
            >
              <Sigma className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={`${t("blockMath")} ($$…$$)`}
              active={editor.isActive("mathBlock")}
              onClick={() => onInsertMath(true)}
            >
              <Radical className="h-3.5 w-3.5" />
            </ToolButton>
          </ToolGroup>

          <Divider />

          <ToolGroup label={t("groupHistory")}>
            <ToolButton
              label={t("undo")}
              shortcut={t("shortcutUndo")}
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("redo")}
              shortcut={t("shortcutRedo")}
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("clearFormatting")}
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            >
              <Eraser className="h-3.5 w-3.5" />
            </ToolButton>
          </ToolGroup>
          </>
        )}
      </div>

      {/* View switcher: rich text / Markdown source / HTML source / split */}
      <div
        role="group"
        aria-label={t("groupView")}
        className="flex shrink-0 items-center gap-0.5 rounded-lg bg-background/70 p-0.5 ring-1 ring-border"
      >
        {views.map(({ value, label, Icon }) => (
          <ToolButton
            key={value}
            label={label}
            active={view === value}
            onClick={() => onSelectView(value)}
            className="h-7 w-7 rounded-md"
          >
            <Icon className="h-3.5 w-3.5" />
          </ToolButton>
        ))}
      </div>
    </div>
  )
}

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {children}
    </div>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-border" />
}

interface ToolButtonProps {
  label: string
  /** Rendered in the tooltip, e.g. "Ctrl+B". */
  shortcut?: string
  /** Toggle buttons pass a boolean so `aria-pressed` is announced. */
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}

function ToolButton({ label, shortcut, active, disabled, onClick, children, className }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      {...(active === undefined ? {} : { "aria-pressed": active })}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        disabled
          ? "cursor-not-allowed opacity-40"
          : active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}
