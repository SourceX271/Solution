"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { RichTextEditor } from "./RichTextEditor"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import Link from "next/link"

interface EditContentFormProps {
  type: string
  item: any
}

const articleCategories = ["tutorial", "guide", "reference", "news", "opinion"]
const softwareCategories = ["tool", "library", "framework", "service", "platform", "other"]

export function EditContentForm({ type, item }: EditContentFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState(item.title || item.name || "")
  const [content, setContent] = useState(item.content || item.description || "")
  const [excerpt, setExcerpt] = useState(item.excerpt || "")
  const [category, setCategory] = useState(item.category || "tutorial")
  const [status, setStatus] = useState(item.status || "draft")
  const [tags, setTags] = useState(item.tags || "[]")
  const [url, setUrl] = useState(item.url || "")
  const [coverImage, setCoverImage] = useState(item.coverImage || "")
  const [image, setImage] = useState(item.image || "")
  const [description, setDescription] = useState(item.description || "")

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { status }
      if (type === "articles") {
        body.title = title
        body.content = content
        body.excerpt = excerpt || null
        body.category = category
        body.tags = tags
        body.coverImage = coverImage || null
      } else if (type === "questions") {
        body.title = title
        body.content = content
        body.tags = tags
      } else if (type === "software") {
        body.name = title
        body.description = description || content
        body.url = url || null
        body.category = category
        body.tags = tags
        body.image = image || null
      }

      const res = await fetch(`/api/admin/content/${type}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.refresh()
        router.push(`/admin/content?type=${type}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/content/${type}/${item.id}`, { method: "DELETE" })
      if (res.ok) {
        router.push(`/admin/content?type=${type}`)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/content?type=${type}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {type}
        </Link>
        <div className="flex items-center gap-3">
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogDescription>
                  Are you sure? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {type === "software" ? "Software Details" : "Content"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  {type === "software" ? "Name" : "Title"}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={type === "software" ? "Software name" : "Content title"}
                />
              </div>

              {type === "software" && (
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}

              {type === "articles" && (
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea
                    id="excerpt"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  {type === "software" ? "Description" : "Content"}
                </Label>
                <RichTextEditor content={content} onChange={setContent} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {type === "articles" && (
                      <>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </>
                    )}
                    {type === "questions" && (
                      <>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </>
                    )}
                    {type === "software" && (
                      <>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(type === "software" ? softwareCategories : articleCategories).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags (JSON array)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder='["tag1", "tag2"]'
                />
              </div>

              {(type === "articles" || type === "software") && (
                <div className="space-y-2">
                  <Label>{type === "articles" ? "Cover Image URL" : "Image URL"}</Label>
                  <Input
                    value={type === "articles" ? coverImage : image}
                    onChange={(e) => type === "articles" ? setCoverImage(e.target.value) : setImage(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span>{item.author?.name || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}