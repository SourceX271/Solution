"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Save } from "lucide-react"

interface SettingsFormProps {
  config: {
    siteName: string
    siteDescription: string
    logo: string | null
    featuredArticle: string | null
    featuredQuestion: string | null
    featuredSoftware: string | null
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
  const [featuredArticle, setFeaturedArticle] = useState(config.featuredArticle || "")
  const [featuredQuestion, setFeaturedQuestion] = useState(config.featuredQuestion || "")
  const [featuredSoftware, setFeaturedSoftware] = useState(config.featuredSoftware || "")

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
          featuredArticle: featuredArticle || null,
          featuredQuestion: featuredQuestion || null,
          featuredSoftware: featuredSoftware || null,
        }),
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* General */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">General</h3>
          <div className="space-y-2">
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="My Site"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteDescription">Site Description</Label>
            <Textarea
              id="siteDescription"
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              placeholder="A community platform..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://...logo.png"
            />
          </div>
        </div>

        {/* Featured Content */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Featured Content</h3>
          <div className="space-y-2">
            <Label>Featured Article</Label>
            <Select value={featuredArticle} onValueChange={setFeaturedArticle}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {articles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Featured Question</Label>
            <Select value={featuredQuestion} onValueChange={setFeaturedQuestion}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {questions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Featured Software</Label>
            <Select value={featuredSoftware} onValueChange={setFeaturedSoftware}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {software.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t pt-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}