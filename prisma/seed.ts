import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create tags
  const tagData = [
    { name: "Windows", slug: "windows", color: "#3b82f6" },
    { name: "性能优化", slug: "xing-neng-you-hua", color: "#10b981" },
    { name: "故障排除", slug: "gu-zhang-pai-chu", color: "#f59e0b" },
    { name: "网络", slug: "wang-luo", color: "#6366f1" },
    { name: "安全", slug: "an-quan", color: "#ef4444" },
    { name: "开发工具", slug: "kai-fa-gong-ju", color: "#8b5cf6" },
    { name: "编辑器", slug: "bian-ji-qi", color: "#06b6d4" },
    { name: "效率工具", slug: "xiao-lu-gong-ju", color: "#84cc16" },
    { name: "免费软件", slug: "mian-fei-ruan-jian", color: "#14b8a6" },
    { name: "杀毒软件", slug: "sha-du-ruan-jian", color: "#f43f5e" },
    { name: "浏览器", slug: "liu-lan-qi", color: "#f97316" },
    { name: "系统工具", slug: "xi-tong-gong-ju", color: "#a855f7" },
  ];

  for (const t of tagData) {
    await prisma.tag.upsert({ where: { slug: t.slug }, update: {}, create: t });
  }
  console.log("Tags created");

  // Create users
  const admin = await prisma.user.upsert({
    where: { email: "admin@solution.local" },
    update: {},
    create: { name: "管理员", email: "admin@solution.local", passwordHash: await hash("admin123", 12), role: "ADMIN", bio: "网站管理员" },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@solution.local" },
    update: {},
    create: { name: "测试用户", email: "user@solution.local", passwordHash: await hash("user123", 12), role: "USER", bio: "一个热爱技术的普通用户" },
  });
  console.log("Users created");

  // Articles
  await prisma.article.upsert({
    where: { slug: "how-to-speed-up-windows" },
    update: {},
    create: {
      title: "如何加速 Windows 系统启动速度",
      slug: "how-to-speed-up-windows",
      content: "## 问题描述\n\nWindows 系统使用一段时间后，启动速度明显变慢。\n\n## 解决方法\n\n### 1. 禁用开机自启动程序\n打开任务管理器（Ctrl+Shift+Esc），切换到启动标签页，禁用不必要的程序。\n\n### 2. 清理磁盘空间\n使用磁盘清理工具删除临时文件。\n\n### 3. 升级到 SSD\n升级到固态硬盘是最有效的提速方式。",
      excerpt: "Windows 系统启动慢？试试这些方法来加速你的电脑。",
      category: "tutorial",
      status: "published",
      authorId: admin.id,
      tags: { connect: [{ slug: "windows" }, { slug: "xing-neng-you-hua" }] },
    },
  });

  await prisma.article.upsert({
    where: { slug: "fix-wifi-disconnecting" },
    update: {},
    create: {
      title: "WiFi 频繁断开的终极解决方案",
      slug: "fix-wifi-disconnecting",
      content: "## 问题分析\n\nWiFi 频繁断开可能由驱动问题、电源管理设置、信道干扰等引起。\n\n## 解决步骤\n\n### 1. 更新网卡驱动\n在设备管理器中找到网络适配器，右键更新驱动程序。\n\n### 2. 关闭电源管理\n取消勾选允许计算机关闭此设备以节约电源。\n\n### 3. 更改 WiFi 信道\n登录路由器管理页面，将信道从自动改为固定信道。",
      excerpt: "WiFi 总是掉线？本文提供了多种有效的解决方法。",
      category: "tutorial",
      status: "published",
      authorId: user.id,
      tags: { connect: [{ slug: "wang-luo" }, { slug: "gu-zhang-pai-chu" }] },
    },
  });

  await prisma.article.upsert({
    where: { slug: "best-dev-tools-2024" },
    update: {},
    create: {
      title: "2024 年最佳开发工具推荐",
      slug: "best-dev-tools-2024",
      content: "## 编辑器\n\n### Visual Studio Code\n免费开源，插件生态丰富。\n\n### JetBrains 系列\n智能代码补全，重构能力强。\n\n## 终端工具\n\n### Windows Terminal\n微软官方出品，支持多标签页。",
      excerpt: "盘点 2024 年最值得使用的开发工具，提升编码效率。",
      category: "guide",
      status: "published",
      authorId: admin.id,
      tags: { connect: [{ slug: "kai-fa-gong-ju" }, { slug: "bian-ji-qi" }] },
    },
  });
  console.log("Articles created");

  // Questions
  const q1 = await prisma.question.upsert({
    where: { slug: "best-antivirus-2024" },
    update: {},
    create: {
      title: "2024年有什么推荐的免费杀毒软件？",
      slug: "best-antivirus-2024",
      content: "最近电脑感觉变慢了，担心可能是中了病毒。请问2024年有哪些免费又好用的杀毒软件推荐？Windows Defender 够用吗？",
      status: "open",
      authorId: user.id,
      tags: { connect: [{ slug: "an-quan" }, { slug: "sha-du-ruan-jian" }, { slug: "mian-fei-ruan-jian" }] },
    },
  });

  await prisma.answer.create({
    data: {
      content: "Windows Defender 对于普通用户来说已经足够用了。它内置于 Windows 10/11，不占用额外资源，防护能力在独立测试中表现优秀。如果需要更强的保护，可以考虑 Bitdefender Free 或 Kaspersky Free。",
      questionId: q1.id,
      authorId: admin.id,
    },
  });

  const q2 = await prisma.question.upsert({
    where: { slug: "chrome-memory-issue" },
    update: {},
    create: {
      title: "Chrome 占用内存太多怎么办？",
      slug: "chrome-memory-issue",
      content: "Chrome 浏览器经常占用 2-3GB 内存，电脑变得很卡。有什么办法可以减少 Chrome 的内存占用？或者有没有更轻量的替代浏览器推荐？",
      status: "open",
      authorId: user.id,
      tags: { connect: [{ slug: "liu-lan-qi" }, { slug: "gu-zhang-pai-chu" }] },
    },
  });

  await prisma.answer.create({
    data: {
      content: "可以尝试以下方法：1) 启用 Chrome 的内存节省模式；2) 关闭不用的标签页；3) 使用 OneTab 等标签管理扩展。如果还是不行，可以考虑换用 Microsoft Edge（同样是 Chromium 内核但内存管理更好）或 Firefox。",
      questionId: q2.id,
      authorId: admin.id,
    },
  });
  console.log("Questions and answers created");

  // Software
  await prisma.software.upsert({
    where: { slug: "vscode" },
    update: {},
    create: {
      name: "Visual Studio Code",
      slug: "vscode",
      description: "微软推出的免费开源代码编辑器，支持海量插件扩展，是开发者最喜爱的代码编辑器之一。支持几乎所有编程语言的语法高亮、智能提示和调试功能。",
      url: "https://code.visualstudio.com",
      category: "development",
      status: "published",
      authorId: admin.id,
      tags: { connect: [{ slug: "bian-ji-qi" }, { slug: "kai-fa-gong-ju" }, { slug: "mian-fei-ruan-jian" }] },
    },
  });

  await prisma.software.upsert({
    where: { slug: "everything-search" },
    update: {},
    create: {
      name: "Everything",
      slug: "everything-search",
      description: "超快速的文件搜索工具，秒级索引 NTFS 分区上的所有文件。比 Windows 自带的搜索快上百倍，是电脑必备的效率工具。",
      url: "https://www.voidtools.com",
      category: "tool",
      status: "published",
      authorId: user.id,
      tags: { connect: [{ slug: "xiao-lu-gong-ju" }, { slug: "mian-fei-ruan-jian" }, { slug: "xi-tong-gong-ju" }] },
    },
  });
  console.log("Software created");

  // Crawl sources
  await prisma.crawlSource.upsert({ where: { id: "seed-1" }, update: {}, create: { id: "seed-1", name: "Stack Overflow Blog", url: "https://stackoverflow.blog", category: "tech", enabled: true } });
  await prisma.crawlSource.upsert({ where: { id: "seed-2" }, update: {}, create: { id: "seed-2", name: "Dev.to", url: "https://dev.to", category: "tech", enabled: true } });

  // Site config
  await prisma.siteConfig.upsert({ where: { id: "main" }, update: {}, create: { id: "main", siteName: "Solution", siteDescription: "社区技术文档与问答平台 — 解决你的每一个电脑问题" } });

  // Update tag usage counts
  const tags = await prisma.tag.findMany({ include: { _count: { select: { articles: true, questions: true, software: true } } } });
  for (const t of tags) {
    await prisma.tag.update({ where: { id: t.id }, data: { usageCount: t._count.articles + t._count.questions + t._count.software } });
  }
  console.log("Tag usage counts updated");

  console.log("Seed completed!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
