import { prisma } from "@/lib/db";
import { serializeNotificationMessage } from "@/lib/notification-message";

export type NotificationType = "comment" | "answer" | "accepted" | "vote";

/** Keys inside the `notifications` namespace. */
export type NotificationMessageKey =
  | "newComment"
  | "newAnswer"
  | "answerAccepted"
  | "newVote";

interface CreateNotificationInput {
  /** Recipient. */
  userId: string;
  /** Who triggered the notification; used to skip self-notifications. */
  actorId?: string;
  type: NotificationType;
  /**
   * ICU key in the `notifications` namespace plus its parameters. Storing the
   * key (instead of a rendered sentence) lets every recipient read the
   * notification in their own language.
   */
  messageKey: NotificationMessageKey;
  messageParams?: Record<string, string>;
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
  type,
  messageKey,
  messageParams,
  link,
}: CreateNotificationInput): Promise<void> {
  if (!userId) return;
  if (actorId && actorId === userId) return;

  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        message: serializeNotificationMessage(messageKey, messageParams),
        link: link ?? null,
      },
    });
  } catch (error) {
    console.error(
      "[notifications] failed to create notification for user",
      userId,
      messageKey,
      error
    );
  }
}
