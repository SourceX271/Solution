"use client"

import type { Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Braces, Brackets, ChevronDown,
  Code, Columns, Eraser, Film, Heading, Highlighter, Image as ImageIcon, Italic, Link as LinkIcon,
  List, ListOrdered, Maximize2, Minimize2, Minus, Paperclip, Pencil, Quote, Radical, Redo2, Sigma,
  Strikethrough, Subscript as SubscriptIcon, Superscript as SuperscriptIcon, Underline, Undo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CODE_LANGUAGES, FONT_FAMILY_PRESETS, FONT_SIZE_PRESETS, HIGHLIGHT_COLOR_PRESETS,
  LINE_HEIGHT_PRESETS, TEXT_ALIGN_VALUES, TEXT_COLOR_PRESETS, normalizeCssColor,
  type TextAlignValue,
} from "@/lib/rich-text-styles"
import type { TextStats } from "@/lib/text-stats"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** What the editor is editing *in*: rich text, Markdown/HTML source, or split. */
export type EditorView = "wysiwyg" | "markdown" | "html" | "split"

/** Kept in sync with `RichEditor`'s picker. */
type MediaKind = "image" | "video" | "attachment"

interface EditorToolbarProps {
  editor: Editor
  view: EditorView
  onSelectView: (view: EditorView) => void
  onInsertLink: () => void
  /** Opens the file picker for one media kind; the upload happens in RichEditor. */
  onInsertMedia: (kind: MediaKind) => void
  /** Which upload is in flight, if any (disables the upload buttons). */
  uploading?: MediaKind | null
  onInsertMath: (displayMode: boolean) => void
  /** Character/word counts for the status row. */
  stats?: TextStats
  /** Fullscreen editing state, mirrored on the toggle button. */
  fullscreen?: boolean
  onToggleFullscreen?: () => void
}

/**
 * Menu/dialog stacking above the fullscreen editor overlay (`z-[60]`). Portals
 * render at `document.body`, so without this the menus would open *behind* the
 * editor they belong to.
 */
const FULLSCREEN_MENU_Z = "z-[70]"

/** Font-family presets paired with their message keys (static, so i18n can see them). */
const FONT_FAMILY_LABEL_KEYS: Record<string, string> = {
  system: "fontFamilySystem",
  serif: "fontFamilySerif",
  kai: "fontFamilyKai",
  hei: "fontFamilyHei",
  mono: "fontFamilyMono",
  cursive: "fontFamilyCursive",
}

/**
 * Editor toolbar.
 *
 * Two rows: formatting groups on top, and a status row with the character count
 * and the view switcher underneath. The status row is the only part shown in
 * source modes, so switching to HTML/Markdown never leaves an empty strip.
 *
 * Grouping follows the labels in the `editor` namespace: text styling, font &
 * spacing, paragraphs & lists, insertion, history.
 */
export function EditorToolbar({
  editor,
  view,
  onSelectView,
  onInsertLink,
  onInsertMedia,
  uploading = null,
  onInsertMath,
  stats,
  fullscreen = false,
  onToggleFullscreen,
}: EditorToolbarProps) {
  const t = useTranslations("editor")
  const isRichText = view === "wysiwyg"

  const headings = [
    { level: 1 as const, label: t("heading1") },
    { level: 2 as const, label: t("heading2") },
    { level: 3 as const, label: t("heading3") },
    { level: 4 as const, label: t("heading4") },
    { level: 5 as const, label: t("heading5") },
    { level: 6 as const, label: t("heading6") },
  ]

  const activeHeading = headings.find(({ level }) => editor.isActive("heading", { level }))
  const blockLabel = activeHeading ? `H${activeHeading.level}` : t("paragraph")

  // Styling can sit on the text (TextStyle mark) or on the block itself when the
  // content came from HTML source mode. Both are read, mark last because it is
  // the more specific one for the current selection.
  const inlineStyle = editor.getAttributes("textStyle") as Record<string, string | null | undefined>
  const blockStyle = {
    ...currentBlockAttributes(editor, ["paragraph", "heading"]),
    ...inlineStyle,
  }
  const activeFontFamily = blockStyle.fontFamily ?? ""
  const activeFontSize = blockStyle.fontSize ?? ""
  const activeLineHeight = blockStyle.lineHeight ?? ""
  // ProseMirror renders `style` through CSSOM, so `#dc2626` comes back as
  // `rgb(220, 38, 38)`; comparing canonical forms keeps the swatches in sync.
  const activeColor = normalizeCssColor(blockStyle.color ?? "")
  const activeHighlight = normalizeCssColor(blockStyle.backgroundColor ?? "")
  const activeCodeLanguage = currentBlockAttributes(editor, ["codeBlock"]).language ?? ""

  const views: { value: EditorView; label: string; Icon: typeof Pencil }[] = [
    { value: "wysiwyg", label: t("richTextMode"), Icon: Pencil },
    { value: "markdown", label: t("markdownSource"), Icon: Code },
    { value: "html", label: t("htmlSource"), Icon: Brackets },
    { value: "split", label: t("splitPreview"), Icon: Columns },
  ]

  const fontFamilyLabel = FONT_FAMILY_PRESETS.find((p) => p.value === activeFontFamily)

  return (
    <div
      className={cn(
        "rounded-t-md border border-input border-b-0 bg-muted/40",
        // Inside the fullscreen overlay the toolbar is a fixed header row.
        fullscreen && "shrink-0 rounded-none border-x-0 border-t-0"
      )}
    >
      {isRichText && (
        <div className="flex flex-wrap items-center gap-1 p-1.5">
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
            <ToolButton
              label={`${t("superscript")} (${t("shortcutSuperscript")})`}
              active={editor.isActive("superscript")}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
            >
              <SuperscriptIcon className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={`${t("subscript")} (${t("shortcutSubscript")})`}
              active={editor.isActive("subscript")}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
            >
              <SubscriptIcon className="h-3.5 w-3.5" />
            </ToolButton>

            <ColorMenu
              label={t("textColor")}
              clearLabel={t("clearColor")}
              colors={TEXT_COLOR_PRESETS}
              value={activeColor}
              icon={<Baseline className="h-3.5 w-3.5" />}
              fullscreen={fullscreen}
              onPick={(color) => editor.chain().focus().setTextStyle({ color }).run()}
              onClear={() => editor.chain().focus().unsetTextStyle(["color"]).run()}
            />
            <ColorMenu
              label={t("highlightColor")}
              clearLabel={t("clearHighlight")}
              colors={HIGHLIGHT_COLOR_PRESETS}
              value={activeHighlight}
              icon={<Highlighter className="h-3.5 w-3.5" />}
              fullscreen={fullscreen}
              onPick={(color) => editor.chain().focus().setTextStyle({ backgroundColor: color }).run()}
              onClear={() => editor.chain().focus().unsetTextStyle(["backgroundColor"]).run()}
            />
          </ToolGroup>

          <Divider />

          <ToolGroup label={t("groupFont")}>
            <ToolbarSelect
              label={t("fontFamily")}
              display={fontFamilyLabel ? t(FONT_FAMILY_LABEL_KEYS[fontFamilyLabel.id] ?? "fontFamilySystem") : t("fontFamily")}
              active={Boolean(activeFontFamily)}
              fullscreen={fullscreen}
            >
              <DropdownMenuItem
                className={cn(!activeFontFamily && "font-medium text-primary")}
                onSelect={() => editor.chain().focus().unsetTextStyle(["fontFamily"]).run()}
              >
                {t("fontFamilyDefault")}
              </DropdownMenuItem>
              {FONT_FAMILY_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className={cn(activeFontFamily === preset.value && "font-medium text-primary")}
                  onSelect={() => editor.chain().focus().setTextStyle({ fontFamily: preset.value }).run()}
                >
                  <span style={{ fontFamily: preset.value }}>
                    {t(FONT_FAMILY_LABEL_KEYS[preset.id] ?? "fontFamilySystem")}
                  </span>
                </DropdownMenuItem>
              ))}
            </ToolbarSelect>

            <ToolbarSelect
              label={t("fontSize")}
              display={activeFontSize || t("fontSize")}
              active={Boolean(activeFontSize)}
              fullscreen={fullscreen}
            >
              <DropdownMenuItem
                className={cn(!activeFontSize && "font-medium text-primary")}
                onSelect={() => editor.chain().focus().unsetTextStyle(["fontSize"]).run()}
              >
                {t("fontSizeDefault")}
              </DropdownMenuItem>
              {FONT_SIZE_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className={cn(activeFontSize === preset.value && "font-medium text-primary")}
                  onSelect={() => editor.chain().focus().setTextStyle({ fontSize: preset.value }).run()}
                >
                  {preset.value}
                </DropdownMenuItem>
              ))}
            </ToolbarSelect>

            <ToolbarSelect
              label={t("lineHeight")}
              display={activeLineHeight || t("lineHeight")}
              active={Boolean(activeLineHeight)}
              fullscreen={fullscreen}
            >
              <DropdownMenuItem
                className={cn(!activeLineHeight && "font-medium text-primary")}
                onSelect={() => editor.chain().focus().unsetTextStyle(["lineHeight"]).run()}
              >
                {t("lineHeightDefault")}
              </DropdownMenuItem>
              {LINE_HEIGHT_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className={cn(activeLineHeight === preset.value && "font-medium text-primary")}
                  onSelect={() => editor.chain().focus().setTextStyle({ lineHeight: preset.value }).run()}
                >
                  {preset.value}
                </DropdownMenuItem>
              ))}
            </ToolbarSelect>
          </ToolGroup>

          <Divider />

          <ToolGroup label={t("groupBlock")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("blockType")} title={t("blockType")} className={TRIGGER_CLASS}>
                  <Heading className="h-3.5 w-3.5" />
                  <span className="w-8 text-left">{blockLabel}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className={cn(fullscreen && FULLSCREEN_MENU_Z, "w-40")}>
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

            {TEXT_ALIGN_VALUES.map((align) => (
              <ToolButton
                key={align}
                label={t(ALIGN_LABEL_KEYS[align])}
                active={editor.isActive({ textAlign: align })}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .setTextAlign(editor.isActive({ textAlign: align }) ? null : align)
                    .run()
                }
              >
                {ALIGN_ICONS[align]}
              </ToolButton>
            ))}

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
            <ToolbarSelect
              label={t("codeLanguage")}
              display={activeCodeLanguage || t("codeLanguageAuto")}
              active={Boolean(activeCodeLanguage)}
              fullscreen={fullscreen}
            >
              <DropdownMenuItem
                className={cn(!activeCodeLanguage && "font-medium text-primary")}
                onSelect={() => editor.chain().focus().updateAttributes("codeBlock", { language: null }).run()}
              >
                {t("codeLanguageAuto")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CODE_LANGUAGES.map((language) => (
                <DropdownMenuItem
                  key={language.id}
                  className={cn(activeCodeLanguage === language.id && "font-medium text-primary")}
                  onSelect={() =>
                    editor.chain().focus().updateAttributes("codeBlock", { language: language.id }).run()
                  }
                >
                  {language.label}
                </DropdownMenuItem>
              ))}
            </ToolbarSelect>
            <ToolButton label={t("horizontalRule")} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
              <Minus className="h-3.5 w-3.5" />
            </ToolButton>
          </ToolGroup>

          <Divider />

          <ToolGroup label={t("groupInsert")}>
            <ToolButton label={t("insertLink")} active={editor.isActive("link")} onClick={onInsertLink}>
              <LinkIcon className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label={t("insertImage")} disabled={uploading === "image"} onClick={() => onInsertMedia("image")}>
              <ImageIcon className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label={t("insertVideo")} disabled={uploading === "video"} onClick={() => onInsertMedia("video")}>
              <Film className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              label={t("insertAttachment")}
              disabled={uploading === "attachment"}
              onClick={() => onInsertMedia("attachment")}
            >
              <Paperclip className="h-3.5 w-3.5" />
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
        </div>
      )}

      {/* Status + view switcher: always visible, including in source modes. */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-1.5 py-1",
          isRichText && "border-t border-input/60"
        )}
      >
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {stats ? `${t("characters")} ${stats.characters} · ${t("words")} ${stats.words}` : ""}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {onToggleFullscreen && (
            <ToolButton
              label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
              active={fullscreen}
              onClick={onToggleFullscreen}
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </ToolButton>
          )}

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
      </div>
    </div>
  )
}

/**
 * Attributes of the nearest enclosing node of one of `types`.
 *
 * `editor.getAttributes(name)` cannot be used here: it walks the document with
 * `nodesBetween(selection.from, selection.to)`, which visits nothing at all for a
 * collapsed caret — i.e. for exactly the case the toolbar cares about — and
 * returns `{}` even when the caret sits in a styled paragraph.
 */
function currentBlockAttributes(
  editor: Editor,
  types: readonly string[]
): Record<string, string | null | undefined> {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (types.includes(node.type.name)) {
      return node.attrs as Record<string, string | null | undefined>
    }
  }
  return {}
}

/** Static label keys for the alignment buttons. */
const ALIGN_LABEL_KEYS: Record<TextAlignValue, string> = {
  left: "alignLeft",
  center: "alignCenter",
  right: "alignRight",
  justify: "alignJustify",
}

const ALIGN_ICONS: Record<TextAlignValue, React.ReactNode> = {
  left: <AlignLeft className="h-3.5 w-3.5" />,
  center: <AlignCenter className="h-3.5 w-3.5" />,
  right: <AlignRight className="h-3.5 w-3.5" />,
  justify: <AlignJustify className="h-3.5 w-3.5" />,
}

const TRIGGER_CLASS =
  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"

/** Compact dropdown used for the font/size/spacing/language pickers. */
function ToolbarSelect({
  label,
  display,
  active,
  fullscreen = false,
  children,
}: {
  label: string
  display: string
  active?: boolean
  fullscreen?: boolean
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(TRIGGER_CLASS, active && "bg-primary/15 text-primary")}
        >
          <span className="max-w-[6rem] truncate">{display}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(fullscreen && FULLSCREEN_MENU_Z, "max-h-72 w-44 overflow-y-auto")}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Colour palette dropdown; the trigger shows the colour currently applied. */
function ColorMenu({
  label,
  clearLabel,
  colors,
  value,
  icon,
  fullscreen = false,
  onPick,
  onClear,
}: {
  label: string
  clearLabel: string
  colors: readonly string[]
  value: string
  icon: React.ReactNode
  fullscreen?: boolean
  onPick: (color: string) => void
  onClear: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(TRIGGER_CLASS, "gap-0.5 px-1.5", value && "text-primary")}
        >
          <span className="relative inline-flex">
            {icon}
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full"
              style={{ backgroundColor: value || "transparent" }}
            />
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn(fullscreen && FULLSCREEN_MENU_Z, "w-auto p-2")}>
        <DropdownMenuLabel className="px-0 pb-1.5 text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        <div className="grid grid-cols-5 gap-1">
          {colors.map((color) => (
            <DropdownMenuItem
              key={color}
              onSelect={() => onPick(color)}
              aria-label={`${label} ${color}`}
              className={cn(
                "h-6 w-6 rounded-md border border-border p-0",
                value === normalizeCssColor(color) && "ring-2 ring-primary ring-offset-1"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onSelect={onClear}>
          {clearLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
