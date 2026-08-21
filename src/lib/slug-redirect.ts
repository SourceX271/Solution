import { prisma } from "@/lib/db";
import { permanentRedirect } from "next/navigation";

/**
 * 301/308 永久重定向旧 URL（如中文 slug）到新 slug。
 *
 * 在详情页查不到内容时调用：如果 SlugRedirect 表里存在 oldSlug 记录，
 * 则永久重定向到新的内容 URL；否则由调用方返回 404。
 *
 * 注：Next.js 的 permanentRedirect() 返回 308，与 301 同为"永久重定向"，
 * 搜索引擎（Google/Bing）对 308 与 301 等同处理，可用于保留 SEO 权重。
 * 使用 raw SQL 查询以避免依赖重新生成的 Prisma client。
 */
export async function resolveSlugRedirect(
  targetType: "article" | "question" | "software",
  oldSlug: string
): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ newSlug: string }>>(
    `SELECT "newSlug" FROM "SlugRedirect" WHERE "oldSlug" = ? AND "targetType" = ? LIMIT 1`,
    oldSlug,
    targetType
  );
  if (!rows || rows.length === 0) return;

  const base =
    targetType === "article"
      ? "/docs/"
      : targetType === "question"
        ? "/questions/"
        : "/software/";

  permanentRedirect(`${base}${rows[0].newSlug}`);
}
