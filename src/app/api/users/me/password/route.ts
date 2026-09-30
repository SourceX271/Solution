import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiHandler, successResponse, AppError } from "@/lib/errors";
import { passwordChangeSchema } from "@/lib/validations";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const PUT = apiHandler({ auth: "required" }, async (req, ctx) => {
  // Throttle password attempts: without this, a stolen session (or a shoulder
  // surfer) could brute-force the current password without limit.
  const { allowed } = checkRateLimit(getRateLimitKey(req, "password-change"), {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });
  if (!allowed) {
    throw new AppError(429, "尝试过于频繁，请稍后再试");
  }

  const parsed = passwordChangeSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }
  const { currentPassword, newPassword } = parsed.data;

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

  if (await compare(newPassword, user.passwordHash)) {
    throw new AppError(400, "新密码不能与当前密码相同");
  }

  const newHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: ctx.session!.user.id },
    data: { passwordHash: newHash },
  });

  return successResponse({ message: "密码已更新" });
});
