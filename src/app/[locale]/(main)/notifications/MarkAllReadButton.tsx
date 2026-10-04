"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * "全部已读" used to be a native <form action="/api/notifications/mark-all">
 * POST, which navigated the browser to the raw JSON response and threw away
 * the notifications page. Call the JSON endpoint and refresh instead.
 */
export function MarkAllReadButton() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/mark-all", { method: "POST" });
      if (!res.ok) throw new Error("request failed");
      toast.success(t("markAllReadSuccess"));
      router.refresh();
    } catch {
      toast.error(tc("operationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium hover:bg-accent transition-all shadow-sm disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
      {t("markAllRead")}
    </button>
  );
}
