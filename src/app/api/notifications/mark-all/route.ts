import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, successResponse } from "@/lib/errors";

export const POST = apiHandler({ auth: "required" }, async (req, ctx) => {
  const userId = ctx.session!.user.id;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return successResponse({ message: "已全部标记为已读" });
});
