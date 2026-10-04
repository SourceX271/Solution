import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { cn, formatRelativeTime } from "@/lib/utils";
import { renderNotificationMessage } from "@/lib/notification-message";
import { redirect } from "next/navigation";
import { Bell, CheckCheck, MessageCircle, MessageSquare, ThumbsUp, UserPlus } from "lucide-react";
import { MarkAllReadButton } from "./MarkAllReadButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("pageTitle") };
}
export const dynamic = "force-dynamic";

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  new_answer: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  answer_accepted: { icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  new_comment: { icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
  vote: { icon: ThumbsUp, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
  new_follower: { icon: UserPlus, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/30" },
  // Aliases written by createNotification() in src/lib/notifications.ts
  comment: { icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
  answer: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  accepted: { icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
};

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const locale = await getLocale();
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
          <h1 className="text-3xl font-bold gradient-text">{t("pageTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? t("unreadCount", { count: unreadCount }) : t("allRead")}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
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
                      {renderNotificationMessage(n.message, t)}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{renderNotificationMessage(n.message, t)}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeTime(n.createdAt, locale)}
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
          <p className="text-muted-foreground">{t("noNotifications")}</p>
        </div>
      )}
    </div>
  )
}
