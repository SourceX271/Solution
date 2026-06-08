import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, successResponse, AppError } from "@/lib/errors";

export const PATCH = apiHandler({ auth: "required" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification) throw new AppError(404, "通知不存在");
  if (notification.userId !== ctx.session!.user.id) throw new AppError(403, "无权操作");

  await prisma.notification.update({ where: { id }, data: { read: true } });
  return successResponse({ message: "已标记为已读" });
});

export const DELETE = apiHandler({ auth: "required" }, async (req, ctx) => {
  const { id } = await ctx.params;
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification) throw new AppError(404, "通知不存在");
  if (notification.userId !== ctx.session!.user.id) throw new AppError(403, "无权操作");

  await prisma.notification.delete({ where: { id } });
  return successResponse({ message: "已删除" });
});