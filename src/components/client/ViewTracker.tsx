"use client";

import { useEffect } from "react";

/**
 * Records a view for the current content item on the client.
 * This keeps view counting out of the server render path so pages
 * can stay statically cached (ISR) instead of being re-rendered
 * (and writing to the DB) on every visit.
 */
export function ViewTracker({
  targetType,
  targetId,
}: {
  targetType: "article" | "question";
  targetId: string;
}) {
  useEffect(() => {
    // Fire and forget; never block or retry.
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId }),
    }).catch(() => {});
  }, [targetType, targetId]);

  return null;
}
