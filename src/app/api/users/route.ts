import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiT } from "@/lib/api-i18n";
import { requireAdminApi } from "@/lib/admin-guard";
import { updateUserAccount } from "@/lib/admin-user-actions";
import { toPositiveInt } from "@/lib/errors";
import { readJson } from "@/lib/request";

export async function GET(req: NextRequest) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = toPositiveInt(searchParams.get("page"), 1);
    const limit = toPositiveInt(searchParams.get("limit"), 20, 100);
    const search = searchParams.get("search");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          bio: true,
          bannedAt: true,
          createdAt: true,
          _count: {
            select: { articles: true, questions: true, answers: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    return NextResponse.json(
      { error: t("getFailed", { entity: t("entity.userList") }) },
      { status: 500 }
    );
  }
}

/**
 * Legacy single-role endpoint kept for API compatibility. It now delegates to
 * the same guarded implementation as `/api/admin/users/[id]` — previously it
 * applied the role straight from the (stale) JWT claim with no self-demote or
 * last-admin protection.
 */
export async function PUT(req: NextRequest) {
  const t = await getApiT("api");
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const body = await readJson(req);
  const { userId, role } = (body ?? {}) as { userId?: string; role?: string };

  if (!userId || !role) {
    return NextResponse.json({ error: t("missingParams") }, { status: 400 });
  }
  if (role !== "USER" && role !== "ADMIN") {
    return NextResponse.json({ error: t("invalidRole") }, { status: 400 });
  }

  try {
    const result = await updateUserAccount(guard.user, userId, { role }, req);
    if (!result.ok) {
      const message =
        result.errorKey === "notFound"
          ? t("notFound", { entity: t("entity.user") })
          : t(result.errorKey);
      return NextResponse.json({ error: message }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("User role update failed", error);
    return NextResponse.json(
      { error: t("updateFailed", { entity: t("entity.user") }) },
      { status: 500 }
    );
  }
}
