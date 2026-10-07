"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TurndownService from "turndown";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Bold, Italic, Heading2, List, ListOrdered, Code, Quote,
  Link as LinkIcon, Image as ImageIcon, Eye, Pencil, Columns, Strikethrough, Undo, Redo
} from "lucide-react";

marked.setOptions({ breaks: true, gfm: true });

/** Allow-list shared by the Markdown preview and RichContent. */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "strong", "b", "em", "i",
    "s", "u", "a", "code", "pre", "ul", "ol", "li", "blockquote", "img",
    "table", "thead", "tbody", "tr", "th", "td", "div", "span",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class"],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:|\/|#)/i,
};

function sanitizePreviewHtml(html: string): string {
  try {
    return DOMPurify.sanitize(html, SANITIZE_CONFIG);
  } catch {
    return html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

interface RichEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  showToolbar?: boolean;
  readOnly?: boolean;
  /** DOM id for the editable area, so a <label htmlFor> can point at it. */
  id?: string;
  /** Id of the element that labels this editor (used with `<Field>`). */
  labelledBy?: string;
  /** Id of the hint/error element describing this editor. */
  describedBy?: string;
  /** Marks the editor as invalid for assistive technology. */
  invalid?: boolean;
}

export function RichEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = "200px",
  showToolbar = true,
  readOnly = false,
  id,
  labelledBy,
  describedBy,
  invalid = false,
}: RichEditorProps) {
  const tc = useTranslations("common");
  const te = useTranslations("editor");
  const [mode, setMode] = useState<"wysiwyg" | "source" | "split">("wysiwyg");
  const [sourceContent, setSourceContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const splitSourceRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  const editor = useEditor({
    // Tiptap 3 renders on the server by default, which breaks Next.js hydration
    // because the editor markup depends on the DOM. Opt out and let the client
    // mount it, as Tiptap's Next.js guide requires.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "code-block" } },
        // StarterKit 3 bundles Link; disable that copy so the explicit
        // LinkExtension below stays the single source of link configuration.
        link: false,
      }),
      Placeholder.configure({ placeholder }),
      ImageExtension.configure({ allowBase64: true }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value || "",
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          "tiptap-editor p-4 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        style: "min-height: " + minHeight,
        // A contenteditable div needs an explicit textbox role to be announced
        // as an input rather than as a generic region.
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });

  /**
   * Accessibility wiring for the editable area.
   *
   * The attributes are set on the ProseMirror DOM node directly: `useEditor`
   * only reads its options on creation, so passing them there would leave a
   * later-appearing error message unattached.
   */
  useEffect(() => {
    const dom = editor?.view?.dom as HTMLElement | undefined;
    if (!dom) return;
    if (id) dom.id = id;
    if (labelledBy) dom.setAttribute("aria-labelledby", labelledBy);
    if (describedBy) dom.setAttribute("aria-describedby", describedBy);
    else dom.removeAttribute("aria-describedby");
    if (invalid) dom.setAttribute("aria-invalid", "true");
    else dom.removeAttribute("aria-invalid");
  }, [editor, id, labelledBy, describedBy, invalid]);

  // Sync external value changes into the editor (e.g., edit mode initialization)
  useEffect(() => {
    if (editor && value !== undefined && !initializedRef.current) {
      initializedRef.current = true;
      if (value !== editor.getHTML()) {
        editor.commands.setContent(value || "");
      }
    }
  }, [editor, value]);

  // Reset initialized flag when value changes externally
  useEffect(() => {
    if (editor && value !== undefined && initializedRef.current) {
      const currentHtml = editor.getHTML();
      // Only sync if the value truly differs (avoid loops)
      if (value && value !== currentHtml && !editor.isFocused) {
        editor.commands.setContent(value);
      }
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert to markdown when switching to source mode
  const switchToSource = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    try {
      const md = turndownService.turndown(html);
      setSourceContent(md || "");
    } catch {
      setSourceContent(html || "");
    }
    setMode("source");
  }, [editor]);

  const switchToSplit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    try {
      const md = turndownService.turndown(html);
      setSourceContent(md || "");
    } catch {
      setSourceContent(html || "");
    }
    setMode("split");
  }, [editor]);

  // Update preview when source content changes
  useEffect(() => {
    if (mode === "source" || mode === "split") {
      try {
        if (sourceContent.trim()) {
          const html = marked.parse(sourceContent) as string;
          // The preview is injected with dangerouslySetInnerHTML, so sanitise it
          // the same way every other HTML sink in the app does.
          setPreviewHtml(sanitizePreviewHtml(html));
        } else {
          setPreviewHtml("");
        }
      } catch {
        setPreviewHtml(`<p class='text-destructive'>${te("markdownError")}</p>`);
      }
    }
    // Translators are new function identities on every render, so they are
    // intentionally not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceContent, mode]);

  // Sync editor changes to parent
  useEffect(() => {
    if (editor && !readOnly) {
      const handler = () => onChange?.(editor.getHTML());
      editor.on("update", handler);
      return () => { editor.off("update", handler) };
    }
  }, [editor, onChange, readOnly]);

  // Auto-resize source textareas
  useEffect(() => {
    const el = mode === "split" ? splitSourceRef.current : sourceRef.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = Math.max(parseInt(minHeight), el.scrollHeight) + "px";
    };
    el.addEventListener("input", resize);
    resize();
    return () => el.removeEventListener("input", resize);
  }, [mode, minHeight, sourceContent]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const md = e.target.value;
    setSourceContent(md);
    try {
      if (md.trim()) {
        const html = marked.parse(md) as string;
        setPreviewHtml(html || "");
        onChange?.(html);
      } else {
        setPreviewHtml("");
        onChange?.("");
      }
    } catch {
      onChange?.(md);
    }
  }, [onChange]);

  const switchToWysiwyg = useCallback(() => {
    if (!editor) return;
    if (sourceContent.trim()) {
      try {
        const html = marked.parse(sourceContent) as string;
        editor.commands.setContent(html || "");
        onChange?.(html || "");
      } catch {
        editor.commands.setContent(sourceContent);
        onChange?.(sourceContent);
      }
    }
    setMode("wysiwyg");
  }, [editor, sourceContent, onChange]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const prevUrl = editor.getAttributes("link").href || "";
    const url = window.prompt(te("linkPrompt"), prevUrl);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt(te("imagePrompt"));
    if (url) editor.chain().focus().setImage({ src: url }).run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-md border bg-muted p-4" style={{ minHeight }}>
        <div className="flex items-center justify-center h-full">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  const btnClass = (active: boolean, disabled = false) =>
    "rounded px-1.5 py-1 text-xs transition-colors " +
    (disabled ? "opacity-30 cursor-not-allowed" :
     active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground");

  const Divider = () => <span className="mx-0.5 w-px h-5 bg-border" />;

  return (
    <div className="rich-editor">
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between rounded-t-md border border-input border-b-0 bg-muted/40 p-1.5 gap-1">
          <div className="flex flex-wrap items-center gap-0.5">
            {mode === "wysiwyg" && (
              <>
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title={te("bold")}>
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title={te("italic")}>
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive("strike"))} title={te("strike")}>
                  <Strikethrough className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))} title={te("heading")}>
                  <Heading2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title={te("bulletList")}>
                  <List className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title={te("orderedList")}>
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive("codeBlock"))} title={te("codeBlock")}>
                  <Code className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive("blockquote"))} title={te("blockquote")}>
                  <Quote className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={insertLink} className={btnClass(editor.isActive("link"))} title={te("insertLink")}>
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={insertImage} className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title={te("insertImage")}>
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btnClass(false, !editor.can().undo())} title={te("undo")}>
                  <Undo className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btnClass(false, !editor.can().redo())} title={te("redo")}>
                  <Redo className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mode switchers */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => setMode("wysiwyg")} title={te("richTextMode")} className={btnClass(mode === "wysiwyg")}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={switchToSource} title={te("markdownSource")} className={btnClass(mode === "source")}>
              {"</>"}
            </button>
            <button type="button" onClick={switchToSplit} title={te("splitPreview")} className={btnClass(mode === "split")}>
              <Columns className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* WYSIWYG mode */}
      {mode === "wysiwyg" && (
        <div className={showToolbar ? "[&_.tiptap-editor]:rounded-t-none [&_.tiptap-editor]:border-t-0" : ""}>
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Source mode */}
      {mode === "source" && (
        <div className="flex flex-col gap-2">
          <textarea
            ref={sourceRef}
            value={sourceContent}
            onChange={handleSourceChange}
            className="w-full rounded-md border border-input bg-background p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            style={{ minHeight }}
            placeholder={te("sourcePlaceholder")}
          />
          <details className="rounded-md border border-input bg-background group" open>
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground select-none">
              <Eye className="mr-1.5 inline-block h-3.5 w-3.5" />
              {tc("preview")}
            </summary>
            <div className="border-t px-4 py-3">
              {previewHtml ? (
                <div className="prose-custom max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="text-sm text-muted-foreground">{te("noContent")}</p>
              )}
            </div>
          </details>
          <div className="flex justify-end">
            <button type="button" onClick={switchToWysiwyg} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              {te("switchToRichText")}
            </button>
          </div>
        </div>
      )}

      {/* Split mode */}
      {mode === "split" && (
        <div className="grid grid-cols-2 border border-input rounded-md overflow-hidden" style={{ minHeight }}>
          <textarea
            ref={splitSourceRef}
            value={sourceContent}
            onChange={handleSourceChange}
            className="w-full border-r border-input bg-background p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring resize-none"
            placeholder={te("sourcePlaceholder")}
          />
          <div className="bg-muted/20 p-4 overflow-auto">
            {previewHtml ? (
              <div className="prose-custom max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-sm text-muted-foreground">{te("noContent")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RichContent({ html }: { html: string }) {
  // Sanitise by default: this is a raw-HTML sink and previously trusted its input.
  return <div className="prose-custom max-w-none" dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(html) }} />;
}