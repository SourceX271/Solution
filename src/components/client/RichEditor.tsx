"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TurndownService from "turndown";
import { marked } from "marked";
import {
  Bold, Italic, Heading2, List, ListOrdered, Code, Quote,
  Link as LinkIcon, Image as ImageIcon, Eye, Pencil, Columns, Strikethrough, Undo, Redo
} from "lucide-react";

marked.setOptions({ breaks: true, gfm: true });

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
}

export function RichEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = "200px",
  showToolbar = true,
  readOnly = false,
}: RichEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "source" | "split">("wysiwyg");
  const [sourceContent, setSourceContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const splitSourceRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "code-block" } },
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
      },
    },
  });

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
          setPreviewHtml(html || "");
        } else {
          setPreviewHtml("");
        }
      } catch {
        setPreviewHtml("<p class='text-destructive'>Markdown 解析错误</p>");
      }
    }
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
    const url = window.prompt("输入链接地址：", prevUrl);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("输入图片地址：");
    if (url) editor.chain().focus().setImage({ src: url }).run();
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
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive("bold"))} title="粗体">
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive("italic"))} title="斜体">
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive("strike"))} title="删除线">
                  <Strikethrough className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive("heading", { level: 2 }))} title="标题">
                  <Heading2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive("bulletList"))} title="无序列表">
                  <List className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive("orderedList"))} title="有序列表">
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive("codeBlock"))} title="代码块">
                  <Code className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive("blockquote"))} title="引用">
                  <Quote className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={insertLink} className={btnClass(editor.isActive("link"))} title="插入链接">
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={insertImage} className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="插入图片">
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <Divider />
                <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btnClass(false, !editor.can().undo())} title="撤销">
                  <Undo className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btnClass(false, !editor.can().redo())} title="重做">
                  <Redo className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mode switchers */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => setMode("wysiwyg")} title="富文本模式" className={btnClass(mode === "wysiwyg")}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={switchToSource} title="Markdown 源码" className={btnClass(mode === "source")}>
              {"</>"}
            </button>
            <button type="button" onClick={switchToSplit} title="分屏预览" className={btnClass(mode === "split")}>
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
            placeholder="输入 Markdown 内容..."
          />
          <details className="rounded-md border border-input bg-background group" open>
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground select-none">
              <Eye className="mr-1.5 inline-block h-3.5 w-3.5" />
              预览
            </summary>
            <div className="border-t px-4 py-3">
              {previewHtml ? (
                <div className="prose-custom max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="text-sm text-muted-foreground">暂无内容</p>
              )}
            </div>
          </details>
          <div className="flex justify-end">
            <button type="button" onClick={switchToWysiwyg} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              切换到富文本
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
            placeholder="输入 Markdown 内容..."
          />
          <div className="bg-muted/20 p-4 overflow-auto">
            {previewHtml ? (
              <div className="prose-custom max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无内容</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RichContent({ html }: { html: string }) {
  return <div className="prose-custom max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}