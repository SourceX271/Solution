"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

const articleCategories = ["solution", "tutorial", "guide", "reference", "news"]
const softwareCategories = ["tool", "library", "framework", "service", "platform", "other"]

const categoryLabels: Record<string, string> = {
  solution: "解决方案", tutorial: "教程", guide: "指南", reference: "参考", news: "资讯",
}

export function EditContentForm({ type, item }: EditContentFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState(item.title || item.name || "")
  const [content, setContent] = useState(item.content || item.description || "")
  const [problem, setProblem] = useState(item.problem || "")
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
        body.problem = problem || null
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

      const res = await fetch("/api/admin/content/" + type + "/" + item.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.refresh()
        router.push("/admin/content?type=" + type)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/content/" + type + "/" + item.id, { method: "DELETE" })
      if (res.ok) router.push("/admin/content?type=" + type)
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={"/admin/content?type=" + type} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />返回
        </Link>
        <div className="flex items-center gap-3">
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2" />删除</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除</DialogTitle>
                <DialogDescription>此操作不可撤销，确定要删除吗？</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "删除中..." : "删除"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />{saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">内容编辑</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{type === "software" ? "名称" : "标题"}</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "software" ? "软件名称" : "标题"} />
              </div>

              {type === "articles" && (
                <div className="space-y-2">
                  <Label htmlFor="problem">遇到的问题</Label>
                  <Textarea id="problem" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="描述这篇文章要解决的问题..." rows={3} />
                </div>
              )}

              {type === "software" && (
                <div className="space-y-2">
                  <Label htmlFor="url">网站地址</Label>
                  <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
                </div>
              )}

              {type === "articles" && (
                <div className="space-y-2">
                  <Label htmlFor="excerpt">摘要</Label>
                  <Textarea id="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="简短描述..." rows={2} />
                </div>
              )}

              <div className="space-y-2">
                <Label>{type === "software" ? "描述" : "内容"}</Label>
                <RichTextEditor content={content} onChange={setContent} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">状态</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {type === "articles" && (<><SelectItem value="published">已发布</SelectItem><SelectItem value="draft">草稿</SelectItem></>)}
                    {type === "questions" && (<><SelectItem value="open">开放</SelectItem><SelectItem value="closed">关闭</SelectItem><SelectItem value="resolved">已解决</SelectItem></>)}
                    {type === "software" && (<><SelectItem value="published">已发布</SelectItem><SelectItem value="pending">待审核</SelectItem></>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(type === "software" ? softwareCategories : articleCategories).map((cat) => (
                      <SelectItem key={cat} value={cat}>{categoryLabels[cat] || cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>标签（JSON数组）</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder='["tag1", "tag2"]' />
              </div>
              {(type === "articles" || type === "software") && (
                <div className="space-y-2">
                  <Label>{type === "articles" ? "封面图 URL" : "图片 URL"}</Label>
                  <Input value={type === "articles" ? coverImage : image} onChange={(e) => type === "articles" ? setCoverImage(e.target.value) : setImage(e.target.value)} placeholder="https://..." />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">作者</span><span>{item.author?.name || "未知"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">创建时间</span><span>{new Date(item.createdAt).toLocaleDateString("zh-CN")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">更新时间</span><span>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}