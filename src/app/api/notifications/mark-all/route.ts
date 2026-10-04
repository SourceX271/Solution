import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { apiHandler, successResponse } from "@/lib/errors";

export const POST = apiHandler({ auth: "required" }, async (req, ctx) => {
  const t = await getApiT("api");
  const userId = ctx.session!.user.id;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return successResponse({ message: t("markAllRead") });
});
