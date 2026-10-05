import { prisma } from "@/lib/db";
import type { AdminUser } from "@/lib/admin-guard";

/**
 * Privileged operations that get written to the audit trail.
 * Keep the values stable: they are stored in the database and filtered on.
 */
export type AuditAction =
  | "content.update"
  | "content.delete"
  | "content.bulkPublish"
  | "content.bulkUnpublish"
  | "content.bulkDelete"
  | "comment.delete"
  | "user.role.update"
  | "user.ban"
  | "user.unban"
  | "user.delete"
  | "crawler.source.create"
  | "crawler.source.update"
  | "crawler.source.delete"
  | "crawler.run"
  | "tag.update"
  | "tag.delete"
  | "tag.merge"
  | "tag.recompute"
  | "settings.update";

export const AUDIT_ACTIONS: AuditAction[] = [
  "content.update",
  "content.delete",
  "content.bulkPublish",
  "content.bulkUnpublish",
  "content.bulkDelete",
  "comment.delete",
  "user.role.update",
  "user.ban",
  "user.unban",
  "user.delete",
  "crawler.source.create",
  "crawler.source.update",
  "crawler.source.delete",
  "crawler.run",
  "tag.update",
  "tag.delete",
  "tag.merge",
  "tag.recompute",
  "settings.update",
];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as string[]).includes(value);
}

/** Best-effort client IP, tolerating proxies. */
export function getClientIp(req?: Request | null): string | undefined {
  if (!req) return undefined;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

interface AuditEntry {
  actor: Pick<AdminUser, "id" | "email">;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
  req?: Request | null;
}

/**
 * Write an audit entry.
 *
 * Auditing must never break the operation it describes: a failed insert is
 * logged to the server console and swallowed.
 */
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actor.id,
        actorEmail: entry.actor.email,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        targetLabel: entry.targetLabel?.slice(0, 200) ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata).slice(0, 4000) : null,
        ip: getClientIp(entry.req),
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", entry.action, error);
  }
}
