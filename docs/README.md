# Solution 开发文档

本目录存放项目开发与维护文档。面向开发者，与用户可见的部署手册（根目录 `DEPLOY.md`）分开。

> 注意：`src/app/[locale]/(main)/solutions/` 是**网站前台的「解决方案」页面路由**，与本目录无关，勿混用。
>
> 该路由原名 `docs/`（URL 为 `/docs`），后统一改为 `/solutions`；旧 URL 由 `next.config.mjs` 的 `redirects()` 永久重定向（308）到新地址，因此历史链接与搜索引擎收录不受影响。

## 文档索引

| 文档 | 内容 |
|---|---|
| [code-audit.md](./code-audit.md) | 系统性代码审查结果：13 项已修复问题（含根因与验证方式）+ 9 项待处理问题（按优先级） |
| [dev-environment.md](./dev-environment.md) | 工程环境陷阱：并发构建冲突、PowerShell 中文编码损坏、沙箱 ACL/spawn 限制、非法 UTF-8 字节的检测与修复 |

## 项目速览

技术栈与结构要点，便于快速上手：

| 层 | 技术 |
|---|---|
| 框架 | Next.js 14.2（App Router，`output: "standalone"`） |
| 语言 | TypeScript 5.4（strict） |
| 数据库 | SQLite + Prisma 5（`prisma/schema.prisma`，12 个模型） |
| 认证 | NextAuth v5 beta：GitHub OAuth + 邮箱密码（bcrypt 12 轮） |
| 国际化 | next-intl 4（zh / en，`localePrefix: as-needed`） |
| UI | Tailwind CSS + Radix（shadcn 风格）+ lucide-react + Tiptap 富文本 |
| 爬虫 | Python 3 + httpx + BeautifulSoup/lxml（`crawler/`，7 个数据源） |
| 部署 | Docker 多阶段构建 + Nginx + SQLite 数据卷 |

内容类型：**解决方案（Article）**、**问答（Question/Answer）**、**软件推荐（Software）**，均支持标签、投票/评分、评论（嵌套回复）与收藏。

关键目录：

```
src/app/[locale]/         前台页面（(main) 公开 / (auth) 登录注册 / admin 后台）
src/app/api/              REST 路由（30+）
src/lib/                  认证、校验、限流、清洗、标签、爬虫入库
src/components/           ui（Radix 封装）/ client（交互）/ layout
crawler/                  Python 爬虫（main.py 为 CLI 入口）
prisma/                   schema、seed、重定向迁移脚本
docs/                     本目录
```

## 站点资源

| 文件 | 用途 | 说明 |
|---|---|---|
| `public/logo.svg` | 站点 logo | 已移除原稿白色底板（透明背景），viewBox 收紧至图形边界 `225.7 245 512 512`，去除了四周约 57% 的空白 |
| `src/app/icon.svg` | 浏览器图标（favicon） | 带白色圆角底，深色标签栏下更清晰；由 App Router 文件约定自动注入 `<link rel="icon">`，无需在 metadata 中配置 |
| `src/components/Logo.tsx` | logo 组件 | 统一入口，尺寸用 `className` 控制（如 `h-8 w-8`） |

使用位置：导航栏（`h-8`）、页脚（`h-9`）、登录页与注册页（`h-10`）、管理后台侧边栏（`h-7`）。

替换 logo 时只需覆盖 `public/logo.svg`（如需改图标同时替换 `src/app/icon.svg`），不必改组件。

## 常用命令

```bash
npm run dev          # 开发服务器（端口 3000）
npm run build        # 生产构建（⚠️ 需先停掉 dev server，见 dev-environment.md）
npm run lint         # ESLint
npx tsc --noEmit --incremental false   # 类型检查（不改动 .next，可随时运行）

npm run db:push      # 同步 Prisma schema 到数据库
npm run db:seed      # 导入种子数据
npm run crawler:run  # 手动运行爬虫（等价于 python -m crawler.main）
```

爬虫可选参数：

```bash
python -m crawler.main --list                     # 列出可用数据源
python -m crawler.main --source devto --limit 3   # 只跑单个源
python -m crawler.main --format jsonl             # 每行一条 JSON
```

> 从项目根目录运行爬虫必须用 **`python -m crawler.main`**，不能用 `python crawler/main.py`（后者会 `ModuleNotFoundError`）。

## 定时爬取

爬虫由 `src/instrumentation.ts` 通过 `node-cron` 定时触发，间隔取 `CRAWLER_INTERVAL_HOURS`（默认 24 小时），**仅在生产环境（`NODE_ENV=production`）注册**。

抓取到的内容以 `status: "draft"` 入库（审核态），需在管理后台 `/admin/content` 审核后才公开；已存在的 `sourceUrl` 会自动跳过。

## 排查指南

| 现象 | 先看 |
|---|---|
| 构建随机失败（`middleware-manifest.json` 缺失、`/_document` 找不到、`copyfile ENOENT`） | `dev-environment.md` 第 1 节——并发构建冲突 |
| 源码中文乱码 / `invalid UTF-8` | `dev-environment.md` 第 2、6 节 |
| `SetNamedSecurityInfoW failed`、`pwsh` 无法启动 | `dev-environment.md` 第 4 节 |
| `prisma db push` / `tsx` 报 `spawn EPERM` | `dev-environment.md` 第 5 节 |
| GitHub 登录报 `redirect_uri is not associated with this application` | GitHub OAuth App 的 Redirect URI 需与访问环境精确匹配（本地 `http://localhost:3000/api/auth/callback/github`，线上 `https://<域名>/api/auth/callback/github`），两者都需注册 |
| 旧链接（含中文的 slug）404 | `SlugRedirect` 表记录映射，详情页会自动永久重定向；新增映射见 `prisma/seed-redirects.ts` |
