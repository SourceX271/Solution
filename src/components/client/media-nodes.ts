"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import { formatBytes } from "@/lib/upload-shared"

/**
 * Two atom nodes for uploaded media.
 *
 * Tiptap has no schema entry for `<video>` or for an attachment link with
 * metadata, so content containing them would be dropped on the way in. Both
 * nodes serialize to plain HTML that the sanitiser allow-list accepts, which
 * keeps stored content renderable without the editor.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export interface VideoAttrs {
  src: string | null
}

/** `<video controls src="…">` — inline playback for uploaded clips. */
export const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: "video[src]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        preload: "metadata",
        class: "media-video",
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("video")
      dom.src = String(node.attrs.src ?? "")
      if (node.attrs.poster) dom.poster = String(node.attrs.poster)
      dom.controls = true
      dom.preload = "metadata"
      dom.className = "media-video"
      dom.setAttribute("contenteditable", "false")
      return {
        dom,
        update: (updated) => updated.type.name === "video" && updated.attrs.src === node.attrs.src,
      }
    }
  },
})

export interface AttachmentAttrs {
  attachmentId: string | null
  url: string | null
  filename: string | null
  size: number | null
  kind: string | null
}

const KIND_ICON: Record<string, string> = {
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  pdf: "📄",
  archive: "🗜️",
  document: "📎",
}

/**
 * A file attachment rendered as a small chip inside the text.
 *
 * Serialized as `<a data-attachment … download>`; `src/lib/attachments.ts` turns
 * that anchor into a full card when the content is read.
 */
export const AttachmentNode = Node.create({
  name: "attachment",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
      url: { default: null },
      filename: { default: null },
      size: { default: null },
      kind: { default: "document" },
    }
  },

  parseHTML() {
    return [{ tag: "a[data-attachment]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { url, filename, size, kind, attachmentId } = node.attrs as AttachmentAttrs
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: url ?? "#",
        download: "true",
        rel: "noopener noreferrer",
        class: "attachment-inline",
        "data-attachment": attachmentId ?? filename ?? "",
        "data-filename": filename ?? "",
        "data-size": String(size ?? ""),
        "data-kind": kind ?? "document",
      }),
      escapeHtml(filename ?? ""),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const attrs = node.attrs as AttachmentAttrs
      const dom = document.createElement("a")
      dom.className = "attachment-inline"
      dom.href = attrs.url ?? "#"
      dom.setAttribute("download", "")
      dom.setAttribute("contenteditable", "false")
      dom.title = attrs.filename ?? ""
      dom.innerHTML =
        `<span aria-hidden="true">${KIND_ICON[attrs.kind ?? "document"] ?? KIND_ICON.document}</span>` +
        `<span class="attachment-inline__name">${escapeHtml(attrs.filename ?? "")}</span>` +
        (attrs.size ? `<span class="attachment-inline__size">${formatBytes(attrs.size)}</span>` : "")
      // Inside the editor a click selects the node instead of navigating away.
      dom.addEventListener("click", (event) => event.preventDefault())
      return { dom }
    }
  },
})

export const mediaNodes = [VideoNode, AttachmentNode]
