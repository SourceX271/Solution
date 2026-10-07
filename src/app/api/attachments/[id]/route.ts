import { prisma } from "@/lib/db";
import { AppError, apiHandler, successResponse } from "@/lib/errors";
import { getSessionUser, isActiveAdmin } from "@/lib/admin-guard";
import { removeStoredUpload } from "@/lib/upload";

/**
 * Delete one uploaded file: its row and the bytes on disk.
 *
 * Allowed for the uploader and for an active admin (re-read from the database,
 * so a demoted or banned admin loses the ability immediately). The row is
 * removed with `deleteMany` so a concurrent double-click cannot turn the second
 * request into a 500.
 */
export const DELETE = apiHandler({ auth: "required" }, async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) throw new AppError(401, "unauthorized");

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, uploaderId: true, url: true },
  });
  if (!attachment) throw new AppError(404, "notFound");
  if (attachment.uploaderId !== user.id && !isActiveAdmin(user)) {
    throw new AppError(403, "forbidden");
  }

  const { count } = await prisma.attachment.deleteMany({ where: { id: attachment.id } });
  if (count > 0) await removeStoredUpload(attachment.url);

  return successResponse({ id: attachment.id });
});
