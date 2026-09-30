import { prisma } from "@/lib/db";

export type NotificationType = "comment" | "answer" | "accepted" | "vote";

interface CreateNotificationInput {
  /** Recipient. */
  userId: string;
  /** Who triggered the notification; used to skip self-notifications. */
  actorId?: string;
  /** Display name of the actor, embedded in the message. */
  actorName?: string | null;
  type: NotificationType;
  /** Short, already-localised body shown in the notification list. */
  message: string;
  link?: string | null;
}

/**
 * Best-effort notification writer.
 *
 * Notifications are a side effect of the main action: a failure here must never
 * fail the request that triggered it, and users should never be notified about
 * their own actions.
 */
export async function createNotification({
  userId,
  actorId,
  actorName,
  type,
  message,
  link,
}: CreateNotificationInput): Promise<void> {
  if (!userId) return;
  if (actorId && actorId === userId) return;

  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        link: link ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[notifications] failed to create notification for user",
      userId,
      actorName ? `(actor: ${actorName})` : "",
      error
    );
  }
}
