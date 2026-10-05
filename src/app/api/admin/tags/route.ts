import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-guard";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Tag list for the admin panel.
 *
 * Returns the stored `usageCount` next to `actualCount` (counted from the
 * relations) so the UI can surface drift — the counter is denormalized and
 * silently wrong once anything bypasses the normal write paths.
 */
export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const where = q
    ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }] }
    : {};

  const [rows, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: [{ usageCount: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        description: true,
        usageCount: true,
        createdAt: true,
        _count: { select: { articles: true, questions: true, software: true } },
      },
    }),
    prisma.tag.count({ where }),
  ]);

  const data = rows.map(({ _count, ...tag }) => ({
    ...tag,
    actualCount: _count.articles + _count.questions + _count.software,
  }));

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
