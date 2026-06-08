import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, getPaginationParams, paginatedResponse } from "@/lib/errors";

export const GET = apiHandler({ auth: "required" }, async (req, ctx) => {
  const { page, limit, skip } = getPaginationParams(req);
  const userId = ctx.session!.user.id;

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return paginatedResponse(data, total, page, limit);
});
