"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Loader2, FileText, MessageCircle, MessageSquare, BookmarkIcon, User, Calendar, Shield } from "lucide-react"

interface ProfileData {
  user: {
    id: string; name: string | null; email: string; image: string | null
    role: string; bio: string | null; createdAt: string
  }
  stats: { articleCount: number; questionCount: number; answerCount: number; softwareCount: number }
  bookmarks: { id: string; targetType: string; targetId: string; createdAt: string; targetTitle?: string; targetSlug?: string }[]
  recentActivity: { type: string; title: string; slug: string; date: string }[]
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/users/profile")
        .then((r) => r.json())
        .then((d) => {
          if (d.success !== false) setProfile(d.data ?? d)
        })
        .finally(() => setLoading(false))
    } else if (status === "unauthenticated") {
      setLoading(false)
    }
  }, [status])

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold gradient-text">请先登录</h1>
        <p className="mb-6 text-muted-foreground">登录后即可查看个人资料</p>
        <Link href="/login" className="btn-gradient inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium shadow-lg shadow-primary/25">
          去登录
        </Link>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        加载失败，请刷新重试
      </div>
    )
  }

  const { user, stats, bookmarks, recentActivity } = profile

  const getTargetLink = (type: string, slug: string | undefined) => {
    const prefix = type === "article" ? "/docs" : type === "question" ? "/questions" : "/software"
    return prefix + "/" + (slug ?? "")
  }

  const getTypeLabel = (type: string) => {
    switch (type) { case "article": return "文章"; case "question": return "问题"; case "software": return "软件"; default: return type }
  }

  const statItems = [
    { label: "文章", value: stats.articleCount, icon: FileText, gradient: "from-blue-500 to-cyan-500" },
    { label: "问题", value: stats.questionCount, icon: MessageCircle, gradient: "from-amber-500 to-orange-500" },
    { label: "回答", value: stats.answerCount, icon: MessageSquare, gradient: "from-emerald-500 to-teal-500" },
    { label: "收藏", value: bookmarks.length, icon: BookmarkIcon, gradient: "from-violet-500 to-fuchsia-500" },
  ]

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 animate-fade-in">
      {/* User Info Card */}
      <div className="glass-card p-6 mb-8 animate-fade-in-up">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-2 ring-primary/20">
            {user.image ? (
              <Image src={user.image} alt={user.name ?? ""} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-primary">
                {(user.name ?? user.email).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{user.name ?? "未设置名称"}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.bio && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{user.bio}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(user.createdAt).toLocaleDateString("zh-CN")} 加入
              </span>
              {user.role === "ADMIN" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Shield className="h-3 w-3" />管理员
                </span>
              )}
            </div>
          </div>
          <Link
            href="/settings"
            className="ml-auto shrink-0 rounded-full border px-4 py-2 text-xs font-medium hover:bg-accent transition-all shadow-sm"
          >
            编辑资料
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statItems.map((s, i) => (
          <div key={s.label} className={cn("stat-card flex flex-col items-center p-4 animate-fade-in-up", `stagger-${i + 1}`)}>
            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${s.gradient} mb-2 shadow-sm`}>
              <s.icon className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tabular-nums">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Bookmarks */}
        <div className="animate-fade-in-up stagger-5">
          <h2 className="mb-3 text-lg font-semibold">我的收藏</h2>
          {bookmarks.length > 0 ? (
            <div className="space-y-2">
              {bookmarks.map((bm) => (
                <Link
                  key={bm.id}
                  href={getTargetLink(bm.targetType, bm.targetSlug)}
                  className="glass-card flex items-center gap-3 p-3.5 group"
                >
                  <BookmarkIcon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                      {bm.targetTitle ?? getTypeLabel(bm.targetType)}
                    </p>
                    <p className="text-xs text-muted-foreground">{getTypeLabel(bm.targetType)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">暂无收藏</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="animate-fade-in-up stagger-6">
          <h2 className="mb-3 text-lg font-semibold">最近动态</h2>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity, idx) => (
                <Link
                  key={idx}
                  href={getTargetLink(activity.type, activity.slug)}
                  className="glass-card block p-3.5 group"
                >
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.date}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">暂无动态</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
