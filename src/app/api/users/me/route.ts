import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiHandler, successResponse } from "@/lib/errors";

export const PUT = apiHandler({ auth: "required" }, async (req, ctx) => {
  const body = await req.json();
  const userId = ctx.session!.user.id;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: body.name,
      bio: body.bio,
      image: body.image,
    },
    select: { id: true, name: true, email: true, image: true, bio: true },
  });

  return successResponse(updated);
});
