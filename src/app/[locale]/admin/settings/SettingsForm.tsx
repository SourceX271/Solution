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
import { useTranslations } from "next-intl"

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
  const t = useTranslations("admin")
  const tc = useTranslations("common")
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
        <h3 className="text-sm font-semibold border-b pb-2">{t("basic")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteName">{t("siteName")}</Label>
            <Input id="siteName" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Solution" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://...logo.png" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteDescription">{t("siteDescription")}</Label>
          <Textarea id="siteDescription" value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} placeholder={tc("siteDescription")} rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="keywords">{t("keywords")}</Label>
          <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("keywordsPlaceholder")} />
        </div>
      </div>

      {/* Contact & Social */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">{t("social")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
            <Input id="contactEmail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubUrl">{t("githubUrl")}</Label>
            <Input id="githubUrl" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twitterUrl">{t("twitterUrl")}</Label>
            <Input id="twitterUrl" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="https://twitter.com/..." />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">{t("footer")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="footerText">{t("footerText")}</Label>
            <Input id="footerText" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="2024 Solution. All rights reserved." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icpNumber">{t("icp")}</Label>
            <Input id="icpNumber" value={icpNumber} onChange={(e) => setIcpNumber(e.target.value)} placeholder={t("icpPlaceholder")} />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">{t("features")}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{tc("solutions")}</p>
              <p className="text-xs text-muted-foreground">{t("featureSolutionsDesc")}</p>
            </div>
            <Switch checked={enableSolutions} onCheckedChange={setEnableSolutions} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{tc("questions")}</p>
              <p className="text-xs text-muted-foreground">{t("featureQuestionsDesc")}</p>
            </div>
            <Switch checked={enableQuestions} onCheckedChange={setEnableQuestions} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{tc("software")}</p>
              <p className="text-xs text-muted-foreground">{t("featureSoftwareDesc")}</p>
            </div>
            <Switch checked={enableSoftware} onCheckedChange={setEnableSoftware} />
          </div>
        </div>
      </div>

      {/* Featured Content */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold border-b pb-2">{t("featured")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("featuredArticle")}</Label>
            <Select value={featuredArticle} onValueChange={setFeaturedArticle}>
              <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("none")}</SelectItem>
                {articles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("featuredQuestion")}</Label>
            <Select value={featuredQuestion} onValueChange={setFeaturedQuestion}>
              <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("none")}</SelectItem>
                {questions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("featuredSoftware")}</Label>
            <Select value={featuredSoftware} onValueChange={setFeaturedSoftware}>
              <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("none")}</SelectItem>
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
          {saving ? tc("saving") : t("saveSettings")}
        </Button>
      </div>
    </div>
  )
}
