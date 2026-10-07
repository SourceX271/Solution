import { hash, compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { getPasswordChangeSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { apiHandler, successResponse, AppError } from "@/lib/errors";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

export const PUT = apiHandler({ auth: "required" }, async (req, ctx) => {
  const t = await getApiT("api");
  const tv = await getApiT("validation");
  // Throttle password attempts: without this, a stolen session (or a shoulder
  // surfer) could brute-force the current password without limit.
  const { allowed } = checkRateLimit(getRateLimitKey(req, "password-change"), {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });
  if (!allowed) {
    throw new AppError(429, t("passwordTooFrequent"));
  }

  const parsed = getPasswordChangeSchema(tv).safeParse(await readJson(req));
  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: ctx.session!.user.id },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    throw new AppError(400, t("passwordOAuth"));
  }

  const isValid = await compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(400, t("passwordWrong"));
  }

  if (await compare(newPassword, user.passwordHash)) {
    throw new AppError(400, t("passwordSame"));
  }

  const newHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: ctx.session!.user.id },
    data: { passwordHash: newHash },
  });

  return successResponse({ message: t("passwordUpdated") });
});
