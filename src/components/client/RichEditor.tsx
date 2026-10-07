"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { EditorToolbar, type EditorView } from "./EditorToolbar";
import { MathBlock, MathInline } from "./math-nodes";
import { AttachmentNode, VideoNode } from "./media-nodes";
import { richTextFormatExtensions } from "./text-style-marks";
import { htmlToMarkdown, markdownToHtml } from "@/lib/editor-markdown";
import { countTextStats, type TextStats } from "@/lib/text-stats";
import { renderLatex, renderMathInHtml, mathElementsToDelimiters } from "@/lib/math";
import { renderAttachmentCards, type AttachmentCardLabels } from "@/lib/attachments";
import { contentPurifyConfig, installContentSanitizer } from "@/lib/sanitize-config";
import { UPLOAD_ACCEPT } from "@/lib/upload-shared";
import { readErrorMessage } from "@/lib/http-error";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/** Set once, on the first client-side preview build. */
let previewHooksInstalled = false;

/**
 * Sanitise preview HTML with the renderer's own allow-list.
 *
 * `RichEditor` is a client component, but Next.js still server-renders it, and
 * `dompurify` returns an inert stub when there is no `window` (its hooks are not
 * even defined there). So the hook is attached lazily and only in the browser;
 * on the server the call behaves exactly as it did before.
 */
function sanitizePreviewHtml(html: string): string {
  try {
    if (!previewHooksInstalled && typeof window !== "undefined") {
      installContentSanitizer(DOMPurify);
      previewHooksInstalled = true;
    }
    return DOMPurify.sanitize(html, contentPurifyConfig());
  } catch {
    return html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

/**
 * Preview pipeline: sanitise first, then expand formulas and attachment cards.
 *
 * Both expansions produce markup that must not be re-sanitised: KaTeX emits
 * positioning styles the CSS allow-list rejects, and attachment cards are
 * generated from attributes the author did not type. So they run after the
 * sanitiser, never before.
 */
function buildPreviewHtml(html: string, labels: AttachmentCardLabels): string {
  return renderAttachmentCards(renderMathInHtml(sanitizePreviewHtml(html)), labels);
}

/**
 * Crude tag stripping, used only to count characters in source mode.
 *
 * The editor's own text is already available through `editor.getText()`; this is
 * for the buffer the author is typing into, where a real DOM pass would run on
 * every keystroke for no benefit.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/** What a toolbar upload button is collecting. */
export type MediaKind = "image" | "video" | "attachment";

interface RichEditorProps {  value?: string;
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
  const [sourceFormat, setSourceFormat] = useState<"markdown" | "html">("markdown");
  const [sourceContent, setSourceContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [mathDialog, setMathDialog] = useState<{ display: boolean; pos: number | null } | null>(null);
  const [mathDraft, setMathDraft] = useState("");
  /** Character/word counts for the toolbar's status row. */
  const [stats, setStats] = useState<TextStats>({ characters: 0, words: 0 });
  /** Which media kind a file picker is currently collecting, and whether one is in flight. */
  const pendingKindRef = useRef<MediaKind | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  /** Fullscreen editing: the whole editor is laid over the page, Esc leaves it. */
  const [fullscreen, setFullscreen] = useState(false);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const splitSourceRef = useRef<HTMLTextAreaElement>(null);
  /**
   * The last HTML handed to `onChange`.
   *
   * The parent echoes it straight back as `value`; comparing against this (rather
   * than against `editor.getHTML()`) is what stops the sync effect from resetting
   * the document — and the undo history — on every keystroke.
   */
  const lastEmittedRef = useRef<string | null>(null);
  /** `mode`, readable from effects that must not re-run when it changes. */
  const modeRef = useRef(mode);
  modeRef.current = mode;
  /** `mathDialog`, readable from the Escape handler without re-binding it. */
  const mathDialogRef = useRef(mathDialog);
  mathDialogRef.current = mathDialog;

  // The node views are created once, when the editor mounts; the ref keeps the
  // double-click handler pointing at the current React state.
  const mathEditRef = useRef<(latex: string, pos: number, display: boolean) => void>(() => {});
  mathEditRef.current = (latex, pos, display) => {
    setMathDraft(latex);
    setMathDialog({ display, pos });
  };

  /** Labels for attachment cards (preview pane and the read-only RichContent). */
  const attachmentLabels: AttachmentCardLabels = useMemo(
    () => ({
      download: tc("download"),
      kinds: {
        image: tc("fileKindImage"),
        video: tc("fileKindVideo"),
        audio: tc("fileKindAudio"),
        pdf: tc("fileKindPdf"),
        archive: tc("fileKindArchive"),
        document: tc("fileKindDocument"),
      },
    }),
    [tc]
  );

  const editor = useEditor({
    // Tiptap 3 renders on the server by default, which breaks Next.js hydration
    // because the editor markup depends on the DOM. Opt out and let the client
    // mount it, as Tiptap's Next.js guide requires.
    immediatelyRender: false,
    // Tiptap 3 defaults this to false; without it the toolbar never re-renders on
    // a selection-only transaction, so its active states and value labels stayed
    // stuck on whatever the last content change left behind.
    shouldRerenderOnTransaction: true,
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
      // LaTeX: `$…$` inline, `$$…$$` block; double-click opens the edit dialog.
      MathInline.configure({ onEdit: (latex, pos) => mathEditRef.current(latex, pos, false) }),
      MathBlock.configure({ onEdit: (latex, pos) => mathEditRef.current(latex, pos, true) }),
      // Uploaded media: `<video>` needs a schema entry to survive parsing, and an
      // attachment keeps its metadata in a dedicated atom node.
      VideoNode,
      AttachmentNode,
      // Colours, fonts, alignment, super/subscript. Their values are validated
      // against the same CSS allow-list the sanitiser uses, so nothing the author
      // can pick here disappears on publish.
      ...richTextFormatExtensions,
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

  /**
   * Character/word counts for the status row.
   *
   * Rich-text mode counts the editor's own text; source/split mode counts the
   * plain text of the buffer, so the number always describes what publishing
   * from the current view would produce.
   */
  useEffect(() => {
    if (!editor || mode !== "wysiwyg") return;
    const update = () => setStats(countTextStats(editor.getText()));
    update();
    editor.on("update", update);
    return () => { editor.off("update", update) };
  }, [editor, mode]);

  /** Push content to the parent, remembering it so the sync effect can skip it. */
  const emit = useCallback(
    (html: string) => {
      lastEmittedRef.current = html;
      onChange?.(html);
    },
    [onChange]
  );

  /**
   * Sync an externally supplied `value` into the editor.
   *
   * Ignored while a source view is open — there the buffer owns the text — and
   * ignored for values this component just emitted (see `lastEmittedRef`).
   */
  useEffect(() => {
    if (!editor || value === undefined) return;
    if (value === lastEmittedRef.current) return;
    if (modeRef.current !== "wysiwyg") return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || "");
  }, [editor, value]);

  /** Editor HTML → source buffer (Markdown, or the HTML itself). */
  const toSource = useCallback((html: string, format: "markdown" | "html") => {
    if (format === "html") return html || "";
    // Markdown cannot express styling, media, attachments or formulas, so
    // `editor-markdown.ts` keeps those elements as raw HTML instead of letting
    // Turndown flatten them.
    return htmlToMarkdown(html || "");
  }, []);

  /** Source buffer → editor HTML. */
  const fromSource = useCallback((source: string, format: "markdown" | "html") => {
    if (format === "html") return source;
    return markdownToHtml(source);
  }, []);

  /**
   * Replace the editor document with source-produced HTML.
   *
   * One insertion path handles both formats: `$…$` text is turned into math nodes
   * by the input rules, while already-tagged `<span data-math>` nodes pass
   * through untouched. An empty buffer clears the document instead of leaving the
   * previous text behind.
   */
  const setEditorContent = useCallback(
    (html: string) => {
      if (!editor) return;
      if (!html.trim()) {
        editor.commands.clearContent();
        return;
      }
      editor
        .chain()
        .insertContentAt({ from: 0, to: editor.state.doc.content.size }, html, {
          applyInputRules: true,
        })
        .run();
    },
    [editor]
  );

  /** Which view the author is looking at right now. */
  const activeView: EditorView =
    mode === "wysiwyg" ? "wysiwyg" : mode === "split" ? "split" : sourceFormat;

  /**
   * Toolbar view switcher.
   *
   * The buffer the author has been typing in is the source of truth: the switch
   * first converts *that* into canonical HTML and only then re-derives the target
   * view. Previously each source format was regenerated from the editor document
   * instead, so edits typed in HTML source mode were silently discarded the
   * moment another format was selected.
   */
  const selectView = useCallback(
    (next: EditorView) => {
      if (!editor) return;
      if (activeView === next) return;

      const html =
        mode === "wysiwyg" ? editor.getHTML() : fromSource(sourceContent, sourceFormat);

      if (next === "wysiwyg") {
        if (mode !== "wysiwyg") setEditorContent(html);
        setMode("wysiwyg");
        emit(editor.getHTML());
        return;
      }

      if (next === "split") {
        setSourceContent(toSource(html, sourceFormat));
        setMode("split");
        return;
      }

      // "markdown" | "html": switch the buffer's format, regenerated from the
      // canonical HTML so nothing goes through the other format on the way.
      setSourceFormat(next);
      setSourceContent(toSource(html, next));
      setMode("source");
    },
    [editor, activeView, mode, sourceContent, sourceFormat, fromSource, toSource, setEditorContent, emit]
  );

  /** Enter/leave fullscreen editing, keeping the caret in the editable area. */
  const toggleFullscreen = useCallback(() => {
    const next = !fullscreen;
    setFullscreen(next);
    if (next) editor?.commands.focus();
  }, [editor, fullscreen]);

  /**
   * Fullscreen: lock the page behind the overlay and exit on Escape.
   *
   * Also flags `<body>`, because the overlay alone cannot win the stacking fight:
   * page containers use `animate-fade-in` (fill-mode `both`), which creates a
   * stacking context with `z-index: auto` around the editor, so the sticky header
   * (`z-50`) painted over the fullscreen toolbar. The `editor-fullscreen` class
   * lifts `<main>` above the header — see globals.css.
   *
   * Radix dialogs close themselves on Escape, so an open formula dialog wins and
   * the editor stays fullscreen.
   */
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("editor-fullscreen");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Escape belongs to whatever is open on top: an open menu (Radix renders
      // its content with `role="menu"` + `data-state="open"`) or the formula
      // dialog. Only when nothing else is open does it leave fullscreen.
      if (mathDialogRef.current !== null) return;
      if (document.querySelector('[role="menu"][data-state="open"], [role="listbox"][data-state="open"]')) {
        return;
      }
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("editor-fullscreen");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  // The editable area fills the overlay instead of keeping its inline min-height.
  useEffect(() => {
    const dom = editor?.view?.dom as HTMLElement | undefined;
    if (!dom) return;
    dom.style.minHeight = fullscreen ? "100%" : minHeight;
  }, [editor, fullscreen, minHeight]);

  // Update preview when source content changes
  useEffect(() => {
    if (mode === "source" || mode === "split") {
      try {
        if (sourceContent.trim()) {
          const html = fromSource(sourceContent, sourceFormat);
          // The preview is injected with dangerouslySetInnerHTML, so sanitise it
          // the same way every other HTML sink in the app does, then expand the
          // formulas (KaTeX needs styles the sanitiser strips from user input).
          setPreviewHtml(buildPreviewHtml(html, attachmentLabels));
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
  }, [sourceContent, sourceFormat, mode]);

  // Count what the source buffer would publish, so the status row keeps matching
  // the view the author is typing in.
  useEffect(() => {
    if (mode === "wysiwyg") return;
    setStats(countTextStats(htmlToPlainText(fromSource(sourceContent, sourceFormat))));
  }, [mode, sourceContent, sourceFormat, fromSource]);

  // Sync editor changes to parent
  useEffect(() => {
    if (editor && !readOnly) {
      const handler = () => emit(editor.getHTML());
      editor.on("update", handler);
      return () => { editor.off("update", handler) };
    }
  }, [editor, emit, readOnly]);

  // Auto-resize source textareas. In fullscreen the layout owns the height, so
  // an inline height would only fight the overlay's own scrolling.
  useEffect(() => {
    if (fullscreen) return;
    const el = mode === "split" ? splitSourceRef.current : sourceRef.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = Math.max(parseInt(minHeight), el.scrollHeight) + "px";
    };
    el.addEventListener("input", resize);
    resize();
    return () => el.removeEventListener("input", resize);
  }, [mode, minHeight, sourceContent, fullscreen]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setSourceContent(next);
    const html = fromSource(next, sourceFormat);
    setPreviewHtml(buildPreviewHtml(html, attachmentLabels));
    emit(html);
  }, [fromSource, sourceFormat, emit, attachmentLabels]);

  /** Insert a new formula, or update the one that was double-clicked. */
  const applyMath = useCallback(() => {
    if (!editor || !mathDialog) return;
    const latex = mathDraft.trim();
    if (!latex) return;
    if (mathDialog.pos === null) {
      editor
        .chain()
        .focus()
        .insertContent({ type: mathDialog.display ? "mathBlock" : "mathInline", attrs: { latex } })
        .run();
    } else {
      const pos = mathDialog.pos;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, { latex });
          return true;
        })
        .run();
    }
    setMathDialog(null);
  }, [editor, mathDialog, mathDraft]);

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

  /** Open the file picker for one media kind (images / video / other files). */
  const pickMedia = useCallback(
    (kind: MediaKind) => {
      pendingKindRef.current = kind;
      const input = fileInputRef.current;
      if (!input) return;
      input.accept = kind === "image" ? "image/*" : kind === "video" ? "video/*" : UPLOAD_ACCEPT;
      input.value = "";
      input.click();
    },
    []
  );

  /**
   * Upload the chosen file and insert it.
   *
   * Uploading happens immediately (before the post is saved) so the author sees
   * what the reader will see; the resulting `Attachment` row is what the
   * attachments page lists for later cleanup.
   */
  const handleFileChosen = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const kind = pendingKindRef.current;
      pendingKindRef.current = null;
      if (!file || !kind || !editor) return;

      setUploading(kind);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("purpose", "content");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = (await res.json().catch(() => null)) as
          | { success?: boolean; url?: string; kind?: string; attachment?: { id: string; originalName: string; size: number; kind: string } }
          | null;

        if (!res.ok || !data?.url) {
          toast.error(await readErrorMessage(res, te("uploadFailed")));
          return;
        }

        if (kind === "image") {
          editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
        } else if (kind === "video") {
          editor.chain().focus().insertContent({ type: "video", attrs: { src: data.url } }).run();
        } else {
          editor.chain().focus().insertContent({
            type: "attachment",
            attrs: {
              attachmentId: data.attachment?.id ?? null,
              url: data.url,
              filename: data.attachment?.originalName ?? file.name,
              size: data.attachment?.size ?? file.size,
              kind: data.attachment?.kind ?? data.kind ?? "document",
            },
          }).run();
        }

        // Inserting an atom leaves it *selected*; the next insert would replace
        // it. Move the caret to the end so consecutive uploads stack up.
        editor.commands.focus("end");
      } catch {
        toast.error(tc("networkError"));
      } finally {
        setUploading(null);
      }
    },
    [editor, tc, te]
  );

  if (!editor) {
    return (
      <div className="rounded-md border bg-muted p-4" style={{ minHeight }}>
        <div className="flex items-center justify-center h-full">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  const currentView: EditorView =
    mode === "wysiwyg" ? "wysiwyg" : mode === "split" ? "split" : sourceFormat === "html" ? "html" : "markdown"

  return (
    <div
      className={cn(
        "rich-editor",
        // In fullscreen the editor becomes its own column: toolbar pinned at the
        // top, the active view scrolls underneath.
        // `z-[60]` must stay above the site header (sticky `z-50`), otherwise the
        // navbar covers the toolbar; anything this editor opens on top of itself
        // (the formula dialog, the toolbar menus) therefore uses `z-[70]`.
        fullscreen && "fixed inset-0 z-[60] flex flex-col bg-background"
      )}
      {...(fullscreen ? { role: "region", "aria-label": te("fullscreen") } : {})}
    >
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          view={currentView}
          onSelectView={selectView}
          onInsertLink={insertLink}
          onInsertMedia={pickMedia}
          uploading={uploading}
          onInsertMath={(displayMode) => {
            setMathDraft("")
            setMathDialog({ display: displayMode, pos: null })
          }}
          stats={stats}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* One hidden picker serves all three upload buttons. */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChosen}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* WYSIWYG mode */}
      {mode === "wysiwyg" && (
        <div
          className={cn(
            showToolbar && "[&_.tiptap-editor]:rounded-t-none [&_.tiptap-editor]:border-t-0",
            fullscreen && "min-h-0 flex-1 overflow-y-auto"
          )}
        >
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Source mode */}
      {mode === "source" && (
        <div className={cn("flex flex-col gap-2", fullscreen && "min-h-0 flex-1 overflow-y-auto")}>
          <textarea
            ref={sourceRef}
            value={sourceContent}
            onChange={handleSourceChange}
            className="w-full rounded-md border border-input bg-background p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            style={{ minHeight: fullscreen ? "45vh" : minHeight }}
            placeholder={sourceFormat === "html" ? te("htmlSourcePlaceholder") : te("sourcePlaceholder")}
          />
          {/* Sets expectations about what a round trip through the source and the
              sanitiser does, instead of rewriting the markup silently. */}
          <p className="text-xs text-muted-foreground">
            {sourceFormat === "html" ? te("htmlModeHint") : te("markdownModeHint")}
          </p>
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
            <button type="button" onClick={() => selectView("wysiwyg")} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              {te("switchToRichText")}
            </button>
          </div>
        </div>
      )}

      {/* Split mode */}
      {mode === "split" && (
        <div
          className={cn(
            "grid grid-cols-2 border border-input rounded-md overflow-hidden",
            fullscreen && "min-h-0 flex-1"
          )}
          style={fullscreen ? undefined : { minHeight }}
        >
          <textarea
            ref={splitSourceRef}
            value={sourceContent}
            onChange={handleSourceChange}
            className={cn(
              "w-full border-r border-input bg-background p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring resize-none",
              fullscreen && "h-full overscroll-contain"
            )}
            placeholder={sourceFormat === "html" ? te("htmlSourcePlaceholder") : te("sourcePlaceholder")}
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

      {/* LaTeX dialog: insert a new formula or edit the double-clicked one */}
      <Dialog open={mathDialog !== null} onOpenChange={(open) => { if (!open) setMathDialog(null); }}>
        <DialogContent
          className={cn("max-w-2xl", fullscreen && "z-[70]")}
          overlayClassName={fullscreen ? "z-[70]" : undefined}
        >
          <DialogHeader>
            <DialogTitle>{mathDialog?.pos === null ? te("mathInsertTitle") : te("mathEditTitle")}</DialogTitle>
            <DialogDescription>{te("mathHint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`${id ?? "rich-editor"}-math-latex`}>{te("mathLabel")}</Label>
              <Textarea
                id={`${id ?? "rich-editor"}-math-latex`}
                value={mathDraft}
                onChange={(event) => setMathDraft(event.target.value)}
                placeholder={te("mathPlaceholder")}
                rows={3}
                className="font-mono text-sm"
                autoFocus
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    applyMath();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium">{te("mathPreview")}</span>
              <div className="min-h-[3.5rem] overflow-x-auto rounded-md border bg-background px-3 py-2 text-sm">
                {mathDraft.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: renderLatex(mathDraft.trim(), mathDialog?.display ?? false) }} />
                ) : (
                  <p className="text-muted-foreground">{te("mathPreviewEmpty")}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMathDialog(null)}>
              {tc("cancel")}
            </Button>
            <Button type="button" onClick={applyMath} disabled={!mathDraft.trim()}>
              {mathDialog?.pos === null ? te("mathInsert") : te("mathUpdate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RichContent({ html }: { html: string }) {
  const t = useTranslations("common");
  // Sanitise by default: this is a raw-HTML sink and previously trusted its input.
  // Formulas and attachment cards are expanded afterwards (their markup needs
  // styles/attributes the allow-list strips from user-supplied HTML).
  const rendered = useMemo(
    () =>
      buildPreviewHtml(html, {
        download: t("download"),
        kinds: {
          image: t("fileKindImage"),
          video: t("fileKindVideo"),
          audio: t("fileKindAudio"),
          pdf: t("fileKindPdf"),
          archive: t("fileKindArchive"),
          document: t("fileKindDocument"),
        },
      }),
    [html, t]
  );

  return <div className="prose-custom max-w-none" dangerouslySetInnerHTML={{ __html: rendered }} />;
}