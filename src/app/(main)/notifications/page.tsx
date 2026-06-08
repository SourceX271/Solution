import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/utils";
import { redirect } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "通知中心",
};

export const dynamic = "force-dynamic";

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

  const typeIcons: Record<string, string> = {
    answer: "💬",
    comment: "✍️",
    vote: "👍",
    accept: "✅",
  };

  const typeLabels: Record<string, string> = {
    answer: "新回答",
    comment: "新评论",
    vote: "点赞",
    accept: "采纳",
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} 条未读通知` : "全部已读"}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action="/api/notifications/mark-all" method="POST">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <CheckCheck className="h-4 w-4" />
              全部已读
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="mb-4 h-12 w-12 opacity-20" />
          <p className="text-lg font-medium">暂无通知</p>
          <p className="text-sm">当有人与你互动时，通知会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                !n.read ? "bg-primary/5 border-primary/20" : "hover:bg-accent"
              }`}
            >
              <span className="mt-0.5 text-xl">{typeIcons[n.type] || "🔔"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {typeLabels[n.type] || n.type}
                  </span>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="mt-1 text-sm">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(n.createdAt)}
                </p>
              </div>
              {n.link && (
                <Link
                  href={n.link}
                  className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
                >
                  查看
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}