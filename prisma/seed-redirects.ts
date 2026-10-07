// 一次性迁移：把旧的中文 slug 映射记录到 SlugRedirect 表，供 301 重定向使用。
// 运行: npx tsx prisma/seed-redirects.ts (需先创建 SlugRedirect 表)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// oldSlug -> newSlug（此前从中文 slug 迁移为随机 id 的记录）
const REDIRECTS: Array<{ oldSlug: string; targetType: string; newSlug: string }> = [
  {
    oldSlug: "电脑wifi连接成功无法上网的解决方法-mt0zoxhg",
    targetType: "article",
    newSlug: "mt133yfcjzzcsy",
  },
  {
    oldSlug: "测试-mt0zr24w",
    targetType: "article",
    newSlug: "mt133yfqb64pxd",
  },
  {
    oldSlug: "一百二十三-mt0zsfuq",
    targetType: "article",
    newSlug: "mt133yfz9tmdsw",
  },
];

async function main() {
  for (const r of REDIRECTS) {
    // Plain Prisma instead of raw SQL: the old `INSERT` derived the primary key
    // from `"seed-" + oldSlug.slice(0, 24)` (two legacy slugs sharing their first
    // 24 UTF-16 units collided) and wrote `datetime('now')` into a `DateTime`
    // column, i.e. a TEXT timestamp among millisecond integers — SQLite sorts
    // TEXT above INTEGER, so `createdAt < now` filtered every seeded row out.
    // Prisma generates the cuid and the millisecond timestamp itself.
    const existing = await prisma.slugRedirect.findUnique({ where: { oldSlug: r.oldSlug } });
    if (existing) {
      console.log(`already exists: ${r.oldSlug}`);
      continue;
    }
    await prisma.slugRedirect.create({ data: r });
    console.log(`redirect: "${r.oldSlug}" -> ${r.targetType}/${r.newSlug}`);
  }
  console.log("Slug redirects seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
