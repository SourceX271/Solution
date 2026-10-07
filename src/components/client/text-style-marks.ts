"use client"

import { Extension, Mark, mergeAttributes } from "@tiptap/core"
import { TEXT_ALIGN_VALUES, filterStyleDeclarations, type TextAlignValue } from "@/lib/rich-text-styles"

/**
 * The formatting marks the editor offers beyond StarterKit: colours, fonts,
 * alignment, super/subscript.
 *
 * Every value goes through `filterStyleDeclarations()` — the same CSS allow-list
 * the server applies when the content is published. That is deliberate: if the
 * editor let the author pick something the sanitiser later drops, the styled text
 * would silently revert on publish, which is precisely the "样式没保存" complaint.
 * Rejecting it at the point of editing keeps "what you see" equal to "what is
 * stored".
 */

export interface TextStyleAttrs {
  color?: string | null
  backgroundColor?: string | null
  fontFamily?: string | null
  fontSize?: string | null
  lineHeight?: string | null
}

/** Editor attribute ⇄ CSS property. */
const STYLE_ATTRIBUTES: ReadonlyArray<{ name: keyof TextStyleAttrs; property: string }> = [
  { name: "color", property: "color" },
  { name: "backgroundColor", property: "background-color" },
  { name: "fontFamily", property: "font-family" },
  { name: "fontSize", property: "font-size" },
  { name: "lineHeight", property: "line-height" },
]

/** Legacy `<font size="1…7">` scale, so pasted HTML keeps its relative sizes. */
const LEGACY_FONT_SIZES: Record<string, string> = {
  "1": "10px",
  "2": "13px",
  "3": "16px",
  "4": "18px",
  "5": "24px",
  "6": "32px",
  "7": "48px",
}

function readStyleAttribute(element: HTMLElement, property: string): string | null {
  const styled = element.style?.getPropertyValue(property)
  if (styled) return styled

  // `<font color size face>` predates CSS and is still produced by Word and
  // other legacy HTML exporters; normalise it to inline styles on import.
  if (property === "color") return element.getAttribute("color")
  if (property === "font-family") return element.getAttribute("face")
  if (property === "font-size") {
    return LEGACY_FONT_SIZES[element.getAttribute("size") ?? ""] ?? null
  }
  return null
}

/** Validate one value against the shared allow-list, returning the value to store. */
function sanitizeStyleValue(property: string, value: string): string | null {
  const declaration = filterStyleDeclarations(`${property}: ${value}`)
  if (!declaration) return null
  return declaration.slice(declaration.indexOf(":") + 1).trim()
}

export const TextStyle = Mark.create({
  name: "textStyle",
  // Runs above the default marks so it wraps rather than sits inside them.
  priority: 101,
  inclusive: true,

  addAttributes() {
    const attributes: Record<string, unknown> = {}
    for (const { name, property } of STYLE_ATTRIBUTES) {
      attributes[name] = {
        default: null,
        parseHTML: (element: HTMLElement) => readStyleAttribute(element, property),
        renderHTML: (values: Record<string, unknown>) =>
          values[name] ? { style: `${property}: ${String(values[name])}` } : {},
      }
    }
    return attributes
  },

  parseHTML() {
    return [{ tag: "span[style]" }, { tag: "font" }]
  },

  renderHTML({ HTMLAttributes }) {
    // The individual attributes already turned into one merged `style` string
    // (mergeAttributes joins style declarations), so nothing else is emitted.
    return ["span", mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setTextStyle:
        (attributes) =>
        ({ commands }) => {
          const next: Record<string, string | null> = {}
          for (const { name, property } of STYLE_ATTRIBUTES) {
            if (!(name in attributes)) continue
            const value = attributes[name]
            if (value === null || value === undefined) {
              next[name] = null
              continue
            }
            const safe = sanitizeStyleValue(property, value)
            if (!safe) return false
            next[name] = safe
          }
          if (Object.keys(next).length === 0) return false
          return commands.setMark(this.name, next)
        },

      unsetTextStyle:
        (keys) =>
        ({ commands }) => {
          if (!keys || keys.length === 0) return commands.unsetMark(this.name)
          const next: Record<string, null> = {}
          for (const key of keys) next[key] = null
          return commands.setMark(this.name, next)
        },
    }
  },
})

/** Node types that accept a `text-align` attribute. */
const TEXT_ALIGN_TYPES = ["paragraph", "heading"] as const

/**
 * Inline alignment, added to the existing paragraph/heading nodes as a global
 * attribute so StarterKit's versions stay the single source of their schema.
 */
export const TextAlign = Extension.create({
  name: "richTextAlign",

  addGlobalAttributes() {
    return [
      {
        types: [...TEXT_ALIGN_TYPES],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = (element.style?.textAlign || element.getAttribute("align") || "").toLowerCase()
              return (TEXT_ALIGN_VALUES as readonly string[]).includes(value) ? value : null
            },
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.textAlign ? { style: `text-align: ${String(attributes.textAlign)}` } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setTextAlign:
        (value: TextAlignValue | null) =>
        ({ commands }) => {
          // Paragraph and heading are alternatives: `updateAttributes` reports
          // false when the selection holds no node of that type, so the results
          // are intentionally ignored instead of short-circuiting the chain.
          for (const type of TEXT_ALIGN_TYPES) {
            commands.updateAttributes(type, { textAlign: value })
          }
          return true
        },
    }
  },
})

interface SupSubOptions {
  /** The tag this mark serialises to, and the mark name. */
  tag: "sup" | "sub"
  name: "superscript" | "subscript"
  /** The opposite mark, removed automatically when this one is applied. */
  excludes: "superscript" | "subscript"
}

function createSupSubMark(options: SupSubOptions) {
  const { tag, name, excludes } = options

  return Mark.create({
    name,
    // `excludes` is what keeps super- and subscript mutually exclusive, the same
    // way word processors behave.
    excludes,
    parseHTML() {
      return [{ tag }]
    },
    renderHTML() {
      return [tag, 0]
    },
  })
}

export const Superscript = createSupSubMark({ tag: "sup", name: "superscript", excludes: "subscript" })
export const Subscript = createSupSubMark({ tag: "sub", name: "subscript", excludes: "superscript" })

/** Commands and shortcuts for the pair above. */
export const SupSubBehavior = Extension.create({
  name: "richTextSupSub",
  addCommands() {
    return {
      toggleSuperscript: () => ({ commands }) => commands.toggleMark("superscript"),
      toggleSubscript: () => ({ commands }) => commands.toggleMark("subscript"),
    }
  },
  addKeyboardShortcuts() {
    return {
      "Mod-.": () => this.editor.commands.toggleSuperscript(),
      "Mod-,": () => this.editor.commands.toggleSubscript(),
    }
  },
})

/** Everything in this module that `useEditor` needs to register. */
export const richTextFormatExtensions = [TextStyle, TextAlign, Superscript, Subscript, SupSubBehavior]

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    richTextStyle: {
      setTextStyle: (attributes: TextStyleAttrs) => ReturnType
      unsetTextStyle: (keys?: Array<keyof TextStyleAttrs>) => ReturnType
      setTextAlign: (value: TextAlignValue | null) => ReturnType
      toggleSuperscript: () => ReturnType
      toggleSubscript: () => ReturnType
    }
  }
}
