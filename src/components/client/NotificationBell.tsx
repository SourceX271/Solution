"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
        setUnreadCount(json.data.filter((n: Notification) => !n.read).length);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await fetch("/api/notifications/" + id, { method: "PATCH" });
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    for (const n of notifications) {
      if (!n.read) await fetch("/api/notifications/" + n.id, { method: "PATCH" });
    }
    fetchNotifications();
  };

  const typeIcons: Record<string, string> = {
    answer: "💬",
    comment: "✍️",
    vote: "👍",
    accept: "✅",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 hover:bg-accent transition-colors"
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-popover shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">通知</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">
                    全部已读
                  </button>
                )}
                <Link href="/notifications" className="text-xs text-muted-foreground hover:underline" onClick={() => setOpen(false)}>
                  查看全部
                </Link>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无通知</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { markAsRead(n.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent last:border-b-0",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <span className="mt-0.5 text-base">{typeIcons[n.type] || "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{n.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
