"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { Loader2, FileText, MessageCircle, MessageSquare, BookmarkIcon } from "lucide-react"

interface ProfileData {
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    role: string
    bio: string | null
    createdAt: string
  }
  stats: {
    articleCount: number
    questionCount: number
    answerCount: number
    softwareCount: number
  }
  bookmarks: {
    id: string
    targetType: string
    targetId: string
    createdAt: string
    targetTitle?: string
    targetSlug?: string
  }[]
  recentActivity: {
    type: string
    title: string
    slug: string
    date: string
  }[]
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/users/profile")
        .then((r) => r.json())
        .then(setProfile)
        .finally(() => setLoading(false))
    } else if (status === "unauthenticated") {
      setLoading(false)
    }
  }, [status])

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">请先登录</h1>
        <p className="mb-6 text-muted-foreground">登录后即可查看个人资料</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
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
    return `${prefix}/${slug ?? ""}`
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "article": return "文章"
      case "question": return "问题"
      case "software": return "软件"
      default: return type
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* User Info Card */}
      <div className="glass-card mb-8 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {user.image ? (
              <Image src={user.image} alt={user.name ?? ""} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">
                {(user.name ?? user.email).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{user.name ?? "未设置名称"}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.bio && <p className="mt-1 text-sm">{user.bio}</p>}
            {user.role === "ADMIN" && (
              <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                管理员
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-card flex flex-col items-center p-4">
          <FileText className="mb-1 h-5 w-5 text-blue-500" />
          <span className="text-lg font-bold">{stats.articleCount}</span>
          <span className="text-xs text-muted-foreground">文章</span>
        </div>
        <div className="glass-card flex flex-col items-center p-4">
          <MessageCircle className="mb-1 h-5 w-5 text-green-500" />
          <span className="text-lg font-bold">{stats.questionCount}</span>
          <span className="text-xs text-muted-foreground">问题</span>
        </div>
        <div className="glass-card flex flex-col items-center p-4">
          <MessageSquare className="mb-1 h-5 w-5 text-orange-500" />
          <span className="text-lg font-bold">{stats.answerCount}</span>
          <span className="text-xs text-muted-foreground">回答</span>
        </div>
        <div className="glass-card flex flex-col items-center p-4">
          <BookmarkIcon className="mb-1 h-5 w-5 text-purple-500" />
          <span className="text-lg font-bold">{bookmarks.length}</span>
          <span className="text-xs text-muted-foreground">收藏</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Bookmarks */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">我的收藏</h2>
          {bookmarks.length > 0 ? (
            <div className="space-y-2">
              {bookmarks.map((bm) => (
                <Link
                  key={bm.id}
                  href={getTargetLink(bm.targetType, bm.targetSlug)}
                  className="glass-card flex items-center gap-3 p-3 transition hover:shadow-md"
                >
                  <BookmarkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-1">
                      {bm.targetTitle ?? `${getTypeLabel(bm.targetType)} ${bm.targetId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{getTypeLabel(bm.targetType)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无收藏
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">最近动态</h2>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity, idx) => (
                <Link
                  key={idx}
                  href={getTargetLink(activity.type, activity.slug)}
                  className="glass-card block p-3 transition hover:shadow-md"
                >
                  <p className="text-sm font-medium line-clamp-1">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.date}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无动态
            </p>
          )}
        </div>
      </div>
    </div>
  )
}