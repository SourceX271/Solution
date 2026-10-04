import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getProfileSchema } from "@/lib/validations";
import { getApiT } from "@/lib/api-i18n";
import { apiHandler, successResponse, AppError } from "@/lib/errors";

export const PUT = apiHandler({ auth: "required" }, async (req, ctx) => {
  const tv = await getApiT("validation");
  const body = await req.json();
  const parsed = getProfileSchema(tv).safeParse(body);

  if (!parsed.success) {
    throw new AppError(400, parsed.error.errors[0].message);
  }

  const userId = ctx.session!.user.id;

  // Only ever touch the fields the caller actually sent, with validated values.
  const data: { name?: string; bio?: string; image?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.image !== undefined) data.image = parsed.data.image;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, image: true, bio: true },
  });

  return successResponse(updated);
});
