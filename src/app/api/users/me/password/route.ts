import { NextRequest } from "next/server";
import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiHandler, successResponse, AppError } from "@/lib/errors";

export const PUT = apiHandler({ auth: "required" }, async (req, ctx) => {
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    throw new AppError(400, "请填写当前密码和新密码");
  }

  if (newPassword.length < 6) {
    throw new AppError(400, "新密码至少6位");
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.session!.user.id },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    throw new AppError(400, "该账户使用 OAuth 登录，无法修改密码");
  }

  const isValid = await compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(400, "当前密码错误");
  }

  const newHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: ctx.session!.user.id },
    data: { passwordHash: newHash },
  });

  return successResponse({ message: "密码已更新" });
});
