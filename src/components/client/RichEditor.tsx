"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TurndownService from "turndown";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { EditorToolbar, type EditorView } from "./EditorToolbar";
import { MathBlock, MathInline } from "./math-nodes";
import { AttachmentNode, VideoNode } from "./media-nodes";
import { renderLatex, renderMathInHtml, mathElementsToDelimiters } from "@/lib/math";
import { renderAttachmentCards, type AttachmentCardLabels } from "@/lib/attachments";
import { contentPurifyConfig, installContentSanitizer } from "@/lib/sanitize-config";
import { UPLOAD_ACCEPT } from "@/lib/upload-shared";
import { readErrorMessage } from "@/lib/http-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

marked.setOptions({ breaks: true, gfm: true });

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
 * KaTeX markup needs its inline styles, which the allow-list deliberately
 * rejects on user input — so it has to be produced after the sanitiser has run,
 * never before. Attachment cards are generated markup for the same reason.
 */
function buildPreviewHtml(html: string, labels: AttachmentCardLabels): string {
  return renderAttachmentCards(renderMathInHtml(sanitizePreviewHtml(html)), labels);
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

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
  /** Which media kind a file picker is currently collecting, and whether one is in flight. */
  const pendingKindRef = useRef<MediaKind | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const splitSourceRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

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

  /** Editor HTML → source buffer (Markdown, or the HTML itself). */
  const toSource = useCallback((html: string, format: "markdown" | "html") => {
    if (format === "html") return html || "";
    try {
      // Turn math nodes back into `$…$` first: turndown does not know about
      // custom nodes and would drop them from the Markdown output entirely.
      return turndownService.turndown(mathElementsToDelimiters(html)) || "";
    } catch {
      return html || "";
    }
  }, []);

  /** Source buffer → editor HTML. */
  const fromSource = useCallback((source: string, format: "markdown" | "html") => {
    if (format === "html") return source;
    return (marked.parse(source) as string) || "";
  }, []);

  const enterMode = useCallback(
    (next: "source" | "split") => {
      if (!editor) return;
      setSourceContent(toSource(editor.getHTML(), sourceFormat));
      setMode(next);
    },
    [editor, sourceFormat, toSource]
  );

  const switchToSplit = useCallback(() => enterMode("split"), [enterMode]);

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
    const next = e.target.value;
    setSourceContent(next);
    const html = fromSource(next, sourceFormat);
    setPreviewHtml(buildPreviewHtml(html, attachmentLabels));
    onChange?.(html);
  }, [fromSource, sourceFormat, onChange, attachmentLabels]);

  const switchToWysiwyg = useCallback(() => {
    if (!editor) return;
    const html = fromSource(sourceContent, sourceFormat);
    if (html.trim()) {
      // One insertion path for both formats: whatever the source, `$…$` text is
      // turned into math nodes by the input rules, while already-tagged
      // `<span data-math>` nodes pass through untouched.
      editor
        .chain()
        .insertContentAt({ from: 0, to: editor.state.doc.content.size }, html, {
          applyInputRules: true,
        })
        .run();
      onChange?.(editor.getHTML());
    }
    setMode("wysiwyg");
  }, [editor, sourceContent, sourceFormat, fromSource, onChange]);

  /**
   * Toolbar view switcher.
   *
   * Rich text and split reuse their existing handlers; the two source views set
   * the format and rebuild the buffer directly from the editor HTML, so
   * switching rich text → HTML never goes through Markdown (which would flatten
   * formulas into `$…$` text).
   */
  const selectView = useCallback(
    (next: EditorView) => {
      if (next === "wysiwyg") {
        switchToWysiwyg();
        return
      }
      if (next === "split") {
        switchToSplit();
        return
      }
      if (!editor) return
      setSourceFormat(next)
      setSourceContent(toSource(editor.getHTML(), next))
      setMode("source")
    },
    [editor, switchToSplit, switchToWysiwyg, toSource]
  );

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
    <div className="rich-editor">
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
            placeholder={sourceFormat === "html" ? te("htmlSourcePlaceholder") : te("sourcePlaceholder")}
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
        <DialogContent className="max-w-2xl">
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