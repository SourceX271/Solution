import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/utils";

export interface TagConnection {
  slug: string;
  name: string;
}

/**
 * 将用户输入的标签名解析为可用的 { name, slug } 连接数据。
 *
 * - 纯 ASCII 标签（如 "windows"）：直接用原名作为 slug（与现有行为一致，
 *   可匹配到 seed 中如 slug="windows" 的标签）。
 * - 含中文/非 ASCII 的标签（如 "性能优化"）：URL 不允许中文，先按 name
 *   查找已有标签（避免重复创建，Tag.name 为 unique），找不到则生成随机
 *   id 作为 slug，保证 /tags/<slug> 永远是纯 ASCII。
 */
export async function resolveTags(input: string[]): Promise<TagConnection[]> {
  const result: TagConnection[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const ascii = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (ascii && /^[a-z0-9-]+$/.test(ascii)) {
      result.push({ name, slug: ascii });
      continue;
    }

    const existing = await prisma.tag.findUnique({ where: { name } });
    result.push(
      existing ? { name, slug: existing.slug } : { name, slug: generateSlug() }
    );
  }

  return result;
}

/** 兼容旧入参：tags 可能是数组、JSON 字符串或逗号分隔字符串 */
export function parseTagInput(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON — fall through to comma split
    }
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}
