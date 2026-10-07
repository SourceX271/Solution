import { prisma } from "@/lib/db";
import { apiHandler, getPaginationParams, paginatedResponse } from "@/lib/errors";

/**
 * Uploaded files of the signed-in user, newest first.
 *
 * The editor uploads immediately (so the attachment card renders while typing),
 * which means a user can accumulate files they never insert into content —
 * this list is how they find and delete them again.
 */
export const GET = apiHandler({ auth: "required" }, async (req, ctx) => {
  const { page, limit, skip } = getPaginationParams(req);
  const userId = ctx.session!.user.id;

  const [data, total] = await Promise.all([
    prisma.attachment.findMany({
      where: { uploaderId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        url: true,
        originalName: true,
        mimeType: true,
        kind: true,
        size: true,
        createdAt: true,
      },
    }),
    prisma.attachment.count({ where: { uploaderId: userId } }),
  ]);

  return paginatedResponse(data, total, page, limit);
});
