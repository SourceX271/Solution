# 架构总览

Solution 是一个中英双语的技术社区站点：**解决方案（文章）/ 问答 / 软件推荐**三类内容，带标签、投票评分、
嵌套评论、收藏、通知与一个完整的管理后台，另有独立的 Python 采集器把外部文章以「草稿」状态入库。

本文只讲结构与设计动机。数据表见 [data-model.md](./data-model.md)，接口见 [api-reference.md](./api-reference.md)，
页面与组件见 [frontend.md](./frontend.md)，安全模型见 [security.md](./security.md)。

---

## 一、技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 15.5（App Router，RSC + ISR） | `output: "standalone"`；14.x 已 EOL，2026-10 升级 |
| UI 运行时 | React 19 | App Router 下的 Next 15 要求 |
| 语言 | TypeScript 5.4（`strict`） | `noEmit`，类型检查由 `npx tsc --noEmit` 承担 |
| 数据库 | SQLite + Prisma 5 | 单文件库，**只有 `db push`、无 migrations** |
| 认证 | NextAuth v5 beta（Auth.js） | GitHub OAuth + 邮箱密码（bcrypt 12 轮），**纯 JWT 会话、无 adapter** |
| 国际化 | next-intl 4 | `zh`（默认，无前缀）/ `en`（`/en` 前缀），`localePrefix: "as-needed"` |
| 富文本 | Tiptap 3 + turndown + marked + highlight.js | 出入两端都过 DOMPurify 白名单 |
| 样式 | Tailwind CSS 3 + Radix（shadcn 风格）+ lucide-react + sonner | `darkMode: "class"` |
| 采集 | Python 3 独立包 `crawler/`（httpx + BeautifulSoup/lxml） | 由 Node 用 `execFile` 调用，`node-cron` 定时 |
| 部署 | Docker 多阶段 + standalone + docker-compose + Nginx | 见 [operations.md](./operations.md) |

---

## 二、目录地图

```
src/
├── app/
│   ├── layout.tsx            根布局：<html lang> + 默认（中文）元数据
│   ├── icon.svg              App Router 文件约定注入的图标
│   ├── robots.ts             /robots.txt
│   ├── sitemap.ts            /sitemap.xml（force-dynamic，双语言）
│   ├── api-docs/page.tsx     开发用接口目录页（不在 [locale] 下，硬编码中文，**内容已过期**）
│   ├── api/                  41 个 route.ts，见 api-reference.md
│   └── [locale]/
│       ├── layout.tsx        本地化元数据 + Provider 链（i18n/主题/会话/Toaster）+ Navbar/Footer
│       ├── (main)/           公开页面：首页、solutions、questions、software、tags、search、profile…
│       ├── (auth)/           login、register
│       └── admin/            管理后台（8 个模块），见 admin-panel.md
├── components/
│   ├── ui/                   Radix 封装原语（16 个）
│   ├── client/               交互组件（20 个，全部 "use client"）
│   ├── layout/               Navbar / Footer / FooterClient
│   ├── admin/                后台通用筛选器、审计动作徽章
│   └── *.tsx                 ThemeProvider、SessionProvider、HtmlLang、JsonLd、Logo
├── i18n/                     routing.ts（路由定义）、request.ts（词条装载）
├── lib/                      业务与基础设施（认证、守卫、校验、限流、清洗、标签、缓存失效、采集入库）
├── instrumentation.ts        服务启动钩子（Node-only 代码动态引入）
└── middleware.ts             next-auth × next-intl 组合中间件 + 页面级守卫
crawler/                      Python 采集器（main.py CLI + sources/ 7 个源）
prisma/                       schema.prisma、seed.ts、seed-redirects.ts
scripts/                      check-i18n.mjs、check-i18n-runtime.mjs
messages/                     zh.json / en.json（各 1075 键）
docs/                         本目录
```

---

## 三、三条主链路

### 1. 读路径（页面）

```
浏览器
  → middleware.ts            next-intl 处理 locale（检测/重定向）→ next-auth 判定登录态与 admin
  → [locale]/layout.tsx      校验 locale、注入 Provider、Navbar/Footer
  → RSC 页面（(main)/**）     直接 Prisma 查询；公开内容页声明 revalidate（ISR）
  → HTML
```

- 公开列表页 ISR 60s、首页 300s、文章详情 3600s、问答详情 1800s；后台页面全部 `force-dynamic`。
- 全站**没有 `generateStaticParams`**，动态段一律按请求渲染后进 ISR 缓存。
- 详情页会调用 `auth()`（读 cookie）以决定是否显示编辑按钮，因此声明了 `revalidate` 的详情页实际按请求动态渲染，
  ISR 声明基本不生效（见 [frontend.md](./frontend.md)「已知行为差异」）。

### 2. 写路径（接口）

```
客户端组件（src/components/client/**）
  → fetch /api/**（同源，带 Session Cookie 与 NEXT_LOCALE cookie）
  → route handler
       ├── 鉴权：apiHandler({auth}) 或 requireAdminApi() 或裸 auth()
       ├── 校验：getXSchema(t)（zod 工厂，错误消息按请求语言翻译）
       ├── 业务：prisma（计数、去重、事务）
       └── 副作用：sanitizeHtml / createNotification / logAdminAction / revalidateContent
```

- 响应格式**不统一**（`{data,total,…}` / `{success,data}` / 裸数组），见 [api-reference.md](./api-reference.md)。
- 后台写操作都会写审计并失效前台 ISR（两种语言前缀一起失效）。

### 3. 采集路径

```
生产环境启动 → instrumentation.register()（只处理 NEXT_RUNTIME=nodejs）
             → 动态 import lib/crawler-scheduler
             → node-cron 按 CRAWLER_INTERVAL_HOURS（1–23，生产环境）注册
或后台「运行」按钮 /「一键全量」→ POST /api/admin/crawler/run
             → lib/crawler-ingest.ts（进程内 inFlight 互斥）
             → execFile(PYTHON_BIN, ["-m","crawler.main", …])
             → Python 抓取，stdout 输出 JSON
             → 按 sourceUrl 去重 → status:"draft" 入库（作者为 crawler@solution.local）
             → 每个源 + 整体各写一条 CrawlLog
```

细节与源清单见 [crawler.md](./crawler.md)。

---

## 四、关键设计决策

| 决策 | 做法 | 代价 / 后果 |
|---|---|---|
| **纯 JWT 会话** | NextAuth v5 无 adapter，`jwt` 回调把 `id`/`role` 写进 token | ① GitHub OAuth 用户不在 `User` 表，写内容会外键失败；② 封禁/降权对已登录的普通用户非即时生效（后台权限因回库重读而是即时的）；③ 无法服务端吊销会话 |
| **三级鉴权** | middleware（JWT 声明）→ `admin/layout.tsx`（回库）→ `requireAdminApi()`（回库） | 前两处使用 JWT 角色的**前台**接口仍存在「降权后 token 未过期」的窗口，见 [security.md](./security.md) |
| **slug 一律纯 ASCII** | `generateSlug()` 生成 `时间戳36进制 + 随机串`，不携带标题；中文标题也能得到稳定 URL | URL 不可读；旧的中文 slug 通过 `SlugRedirect` 表 308 重定向兜底 |
| **采集内容进审核队列** | 采集入库固定 `status: "draft"`，后台审核后才公开 | 不走审核就看不到内容；`/admin` 侧栏带待审数量徽标 |
| **多态关联** | `Comment` / `Vote` / `Bookmark` 用 `targetType + targetId` 指向四类内容，无外键 | 数据库层无引用完整性，删除内容时必须显式清理（各删除路径都调用了清理逻辑） |
| **冗余计数** | `Question.answerCount/voteCount`、`Answer.voteCount`、`Software.rating/ratingCount`、`Tag.usageCount` | 读路径免聚合；代价是每个写路径都要同步维护，见 [data-model.md](./data-model.md) |
| **审计追加写** | `AuditLog` 的 `actorId`/`actorEmail` 故意不做外键，写入失败只打日志 | 删号后日志仍在；审计可能静默缺失（有 `console.error`） |
| **通知存结构体** | `Notification.message` 存 `{"key","params"}`，渲染时按**读者**语言生成 | 老数据（纯文本）原样返回，兼容 |
| **Node-only 代码隔离** | 存在 Edge middleware 时 `instrumentation.ts` 也会被打进 Edge 包，故 `node-cron`/`child_process` 必须放在 `NEXT_RUNTIME === "nodejs"` 分支**内部**动态 import | 写错位置会让 `next build` 直接失败（已在 [README](./README.md) 排障表登记） |
| **服务端直读 Prisma** | 列表页、后台页在 RSC 里直接查询，不经过自家 REST API | 少一次网络往返；代价是同一份查询逻辑在页面与 API 各写一遍 |

---

## 五、现存不一致与技术债（分析结论）

按影响面排序。这些是**当前代码的真实状态**，不是待办清单的重复。

| 类别 | 具体表现 |
|---|---|
| 鉴权 | 前台内容写接口（articles/questions/software/answers/comments 的 PUT/DELETE）用 **JWT 里的 `role`** 做管理员旁路；只有 `/api/admin/**` 与 `apiHandler({auth:"admin"})` 回库重读 |
| 鉴权 | 页面内 `redirect("/login")`（settings、notifications 两个页面）丢了 locale 前缀，`/en` 用户会被送到中文登录页 |
| 接口风格 | 响应包裹三种格式并存；非法 JSON body 在前台路由会落进 `catch` 返回 500 而非 400 |
| 缓存 | 前台内容 `DELETE`、评论/答案的增删改**不**调用 `revalidateContent`，前台需等 ISR 过期 |
| 浏览量 | `GET /api/articles/[id]`、`GET /api/questions/[id]` 读时自增 + `POST /api/views` 客户端打点 = 同一页面两套计数入口，且无去重；`GET /api/software/[id]` 不自增 |
| 文档 | `/api-docs` 页面（对外可见）列出的端点有多个并不存在（`/api/crawler/run`、`/api/admin/content`、`/api/admin/users`、`POST /api/answers`），且是全站唯一硬编码中文的界面 |
| 类型 | `src/lib/types.ts` 的枚举与实现漂移：`QuestionStatus` 缺 `solved`、`ArticleCategory` 含 UI 未提供的 `news`、`SoftwareCategory` 的 `service` 与 UI 的 `development/website/game` 不一致 |
| 死代码 | `components/ui/tabs.tsx`、`components/ui/toast.tsx`（实际用 sonner）、`components/client/Pagination.tsx`、`components/client/CodeBlock.tsx` 无任何引用；`lib/utils.ts` 的 `slugify()` 无调用点 |
| 数据库 | 无 migrations，schema 变更只能 `db push`；`User.email`、`Tag.slug`、`*.slug` 上 `@unique` 与 `@@index` 重复 |
| 运维 | 限流是进程内存 Map（多实例不共享）；Docker 无 healthcheck；容器 3000 端口直接对外发布 |
| 测试 | 无测试框架与测试目录；CI 未配置（`next lint`、`i18n:check` 都需手工或 CI 里显式调用） |

已修复与逐条验证记录见 [code-audit.md](./code-audit.md)；依赖漏洞处置见
[dependency-audit-2026-10.md](./dependency-audit-2026-10.md)。
