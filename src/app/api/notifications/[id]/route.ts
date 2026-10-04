import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { apiHandler, successResponse, AppError } from "@/lib/errors";

export const PATCH = apiHandler({ auth: "required" }, async (req, ctx) => {
  const t = await getApiT("api");
  const { id } = await ctx.params;
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification) throw new AppError(404, t("notFound", { entity: t("entity.notification") }));
  if (notification.userId !== ctx.session!.user.id) throw new AppError(403, t("forbidden"));

  await prisma.notification.update({ where: { id }, data: { read: true } });
  return successResponse({ message: t("markRead") });
});

export const DELETE = apiHandler({ auth: "required" }, async (req, ctx) => {
  const t = await getApiT("api");
  const { id } = await ctx.params;
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification) throw new AppError(404, t("notFound", { entity: t("entity.notification") }));
  if (notification.userId !== ctx.session!.user.id) throw new AppError(403, t("forbidden"));

  await prisma.notification.delete({ where: { id } });
  return successResponse({ message: t("deleted", { entity: t("entity.notification") }) });
});
