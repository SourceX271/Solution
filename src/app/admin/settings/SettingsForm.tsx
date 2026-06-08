"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Save } from "lucide-react"

interface SettingsFormProps {
  config: {
    siteName: string
    siteDescription: string
    logo: string | null
    keywords: string | null
    contactEmail: string | null
    githubUrl: string | null
    twitterUrl: string | null
    footerText: string | null
    icpNumber: string | null
    featuredArticle: string | null
    featuredQuestion: string | null
    featuredSoftware: string | null
    enableSolutions: boolean
    enableQuestions: boolean
    enableSoftware: boolean
  }
  articles: { id: string; title: string }[]
  questions: { id: string; title: string }[]
  software: { id: string; name: string }[]
}

export function SettingsForm({ config, articles, questions, software }: SettingsFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [siteName, setSiteName] = useState(config.siteName)
  const [siteDescription, setSiteDescription] = useState(config.siteDescription)
  const [logo, setLogo] = useState(config.logo || "")
  const [keywords, setKeywords] = useState(config.keywords || "")
  const [contactEmail, setContactEmail] = useState(config.contactEmail || "")
  const [githubUrl, setGithubUrl] = useState(config.githubUrl || "")
  const [twitterUrl, setTwitterUrl] = useState(config.twitterUrl || "")
  const [footerText, setFooterText] = useState(config.footerText || "")
  const [icpNumber, setIcpNumber] = useState(config.icpNumber || "")
  const [featuredArticle, setFeaturedArticle] = useState(config.featuredArticle || "")
  const [featuredQuestion, setFeaturedQuestion] = useState(config.featuredQuestion || "")
  const [featuredSoftware, setFeaturedSoftware] = useState(config.featuredSoftware || "")
  const [enableSolutions, setEnableSolutions] = useState(config.enableSolutions)
  const [enableQuestions, setEnableQuestions] = useState(config.enableQuestions)
  const [enableSoftware, setEnableSoftware] = useState(config.enableSoftware)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          siteDescription,
          logo: logo || null,
          keywords: keywords || null,
          contactEmail: contactEmail || null,
          githubUrl: githubUrl || null,
          twitterUrl: twitterUrl || null,
          footerText: footerText || null,
          icpNumber: icpNumber || null,
          featuredArticle: featuredArticle || null,
          featuredQuestion: featuredQuestion || null,
          featuredSoftware: featuredSoftware || null,
          enableSolutions,
          enableQuestions,
          enableSoftware,
        }),
      })
      if (res.ok) router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* General */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">基本设置</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteName">网站名称</Label>
            <Input id="siteName" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Solution" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://...logo.png" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteDescription">网站描述</Label>
          <Textarea id="siteDescription" value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} placeholder="社区解决方案与问答平台" rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="keywords">SEO 关键词（逗号分隔）</Label>
          <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="技术,编程,解决方案,问答" />
        </div>
      </div>

      {/* Contact & Social */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">联系与社交</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">联系邮箱</Label>
            <Input id="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubUrl">GitHub 地址</Label>
            <Input id="githubUrl" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitterUrl">Twitter 地址</Label>
            <Input id="twitterUrl" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://twitter.com/..." />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">页脚设置</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="footerText">版权文字</Label>
            <Input id="footerText" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="2024 Solution. All rights reserved." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icpNumber">ICP 备案号</Label>
            <Input id="icpNumber" value={icpNumber} onChange={(e) => setIcpNumber(e.target.value)} placeholder="京ICP备XXXXXXXX号" />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">功能开关</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">解决方案</p>
              <p className="text-xs text-muted-foreground">用户可分享遇到的问题和解决方案</p>
            </div>
            <Switch checked={enableSolutions} onCheckedChange={setEnableSolutions} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">问答</p>
              <p className="text-xs text-muted-foreground">用户可提问和回答技术问题</p>
            </div>
            <Switch checked={enableQuestions} onCheckedChange={setEnableQuestions} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">软件推荐</p>
              <p className="text-xs text-muted-foreground">用户可推荐和评价软件工具</p>
            </div>
            <Switch checked={enableSoftware} onCheckedChange={setEnableSoftware} />
          </div>
        </div>
      </div>

      {/* Featured Content */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">精选内容</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>精选解决方案</Label>
            <Select value={featuredArticle} onValueChange={setFeaturedArticle}>
              <SelectTrigger><SelectValue placeholder="无" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无</SelectItem>
                {articles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>精选问题</Label>
            <Select value={featuredQuestion} onValueChange={setFeaturedQuestion}>
              <SelectTrigger><SelectValue placeholder="无" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无</SelectItem>
                {questions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>精选软件</Label>
            <Select value={featuredSoftware} onValueChange={setFeaturedSoftware}>
              <SelectTrigger><SelectValue placeholder="无" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无</SelectItem>
                {software.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t pt-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  )
}