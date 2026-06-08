"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import TurndownService from "turndown";
import { marked } from "marked";
import {
  Bold, Italic, Heading2, List, ListOrdered, Code, Quote,
  Link as LinkIcon, Image as ImageIcon, Eye, Pencil, Columns
} from "lucide-react";

marked.setOptions({ breaks: true, gfm: true });

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      ImageExtension.configure({ allowBase64: true }),
      LinkExtension.configure({ openOnClick: false }),
    ],
    content: value || "",
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none p-4 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring",
        style: "min-height: " + minHeight,
      },
    },
  });

  useEffect(() => {
    if (editor && mode === "source" && value) {
      const md = turndownService.turndown(value);
      setSourceContent(md);
    }
  }, [editor, mode, value]);

  useEffect(() => {
    if (mode === "source" || mode === "split") {
      try {
        const html = marked.parse(sourceContent) as string;
        setPreviewHtml(html);
      } catch {
        setPreviewHtml("");
      }
    }
  }, [sourceContent, mode]);

  useEffect(() => {
    if (editor && !readOnly) {
      editor.on("update", () => onChange?.(editor.getHTML()));
    }
  }, [editor, onChange, readOnly]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const md = e.target.value;
    setSourceContent(md);
    try {
      const html = marked.parse(md) as string;
      setPreviewHtml(html);
      onChange?.(html);
    } catch {}
  }, [onChange]);

  const switchToWysiwyg = useCallback(() => {
    if (editor && sourceContent) {
      try {
        const html = marked.parse(sourceContent) as string;
        editor.commands.setContent(html);
        onChange?.(html);
      } catch {}
    }
    setMode("wysiwyg");
  }, [editor, sourceContent, onChange]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    "rounded px-2 py-1 text-xs transition-colors " + (active ? "bg-primary text-primary-foreground" : "hover:bg-accent");

  const toolbarButtons = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
  ];

  return (
    <div className="rich-editor">
      {showToolbar && (
        <div className="flex items-center justify-between rounded-t-md border border-b-0 bg-muted/50 p-1">
          <div className="flex flex-wrap gap-0.5">
            {mode === "wysiwyg" && (
              <>
                {toolbarButtons.map((btn, i) => (
                  <button key={i} type="button" onClick={btn.action} className={btnClass(btn.active)}>
                    <btn.icon className="h-3.5 w-3.5" />
                  </button>
                ))}
                <span className="mx-0.5 w-px bg-border" />
                <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive("codeBlock"))}>
                  <Code className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive("blockquote"))}>
                  <Quote className="h-3.5 w-3.5" />
                </button>
                <span className="mx-0.5 w-px bg-border" />
                <button type="button" onClick={insertLink} className={btnClass(editor.isActive("link"))}>
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={insertImage} className="rounded px-2 py-1 text-xs hover:bg-accent transition-colors">
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setMode("wysiwyg")} className={btnClass(mode === "wysiwyg")}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => { const md = turndownService.turndown(editor.getHTML()); setSourceContent(md); setMode("source"); }} className={btnClass(mode === "source")}>
              {"</>"}
            </button>
            <button type="button" onClick={() => { const md = turndownService.turndown(editor.getHTML()); setSourceContent(md); setMode("split"); }} className={btnClass(mode === "split")}>
              <Columns className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {mode === "wysiwyg" && <EditorContent editor={editor} />}

      {mode === "source" && (
        <div className="flex flex-col gap-2">
          <textarea
            value={sourceContent}
            onChange={handleSourceChange}
            className="w-full rounded-md border bg-background p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ minHeight }}
            placeholder="Markdown..."
          />
          <details className="rounded-md border bg-background">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <Eye className="mr-1 inline-block h-3.5 w-3.5" />
              Preview
            </summary>
            <div className="border-t px-4 py-3">
              <div className="prose-custom max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </details>
        </div>
      )}

      {mode === "split" && (
        <div className="grid grid-cols-2 gap-0">
          <textarea
            value={sourceContent}
            onChange={handleSourceChange}
            className="w-full rounded-l-md border bg-background p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ minHeight }}
            placeholder="Markdown..."
          />
          <div className="rounded-r-md border bg-muted/30 p-4 overflow-auto" style={{ minHeight }}>
            <div className="prose-custom max-w-none text-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}

      {mode === "source" && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={switchToWysiwyg} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Switch to WYSIWYG
          </button>
        </div>
      )}
    </div>
  );
}

export function RichContent({ html }: { html: string }) {
  return <div className="prose-custom max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}