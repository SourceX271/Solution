"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * "全部已读" used to be a native <form action="/api/notifications/mark-all">
 * POST, which navigated the browser to the raw JSON response and threw away
 * the notifications page. Call the JSON endpoint and refresh instead.
 */
export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/mark-all", { method: "POST" });
      if (!res.ok) throw new Error("request failed");
      toast.success("已全部标记为已读");
      router.refresh();
    } catch {
      toast.error("操作失败，请稍后重试");
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
      全部已读
    </button>
  );
}
