import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { cn, formatRelativeTime } from "@/lib/utils";
import { redirect } from "next/navigation";
import { Bell, CheckCheck, MessageCircle, MessageSquare, ThumbsUp, UserPlus } from "lucide-react";

export const metadata: Metadata = { title: "通知中心" };
export const dynamic = "force-dynamic";

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  new_answer: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  answer_accepted: { icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  new_comment: { icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
  vote: { icon: ThumbsUp, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
  new_follower: { icon: UserPlus, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/30" },
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user?.id as string;

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">通知中心</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} 条未读通知` : "全部已读"}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action="/api/notifications/mark-all" method="POST">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium hover:bg-accent transition-all shadow-sm"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              全部已读
            </button>
          </form>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const config = typeConfig[n.type] ?? { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
            const Icon = config.icon;
            return (
              <div
                key={n.id}
                className={cn(
                  "glass-card flex items-start gap-3 p-4 animate-fade-in-up",
                  !n.read && "border-primary/20 bg-primary/[0.02]",
                  i < 8 && `stagger-${i + 1}`
                )}
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link href={n.link} className="text-sm font-medium hover:text-primary transition-colors line-clamp-2">
                      {n.message}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{n.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(n.createdAt)}
                    {!n.read && (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary" />
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Bell className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">暂无通知</p>
        </div>
      )}
    </div>
  )
}
