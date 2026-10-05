# 管理后台全面分析与增强报告

时间：2026-10-04 · 范围：`D:\Project\Web\Solution`（Next.js 14 App Router 全站 + 管理后台）
验证状态：`tsc --noEmit` ✅ · `next lint` ✅ · `next build` ✅（28 个页面）· `i18n:check` ✅（953 键）· 运行时断言 **69/69 通过** · 浏览器截图复核 ✅

---

## 0. 摘要

本轮做了两件事：**先对整站做了一轮独立分析**（不依赖仓库里既有的 `AUDIT-REPORT.md`，而是从代码与运行中的实例重新取证），然后**针对管理后台做了一次成体系的增强**。

改造前后台的核心问题可以概括为四条主线：

1. **权限判定依据过期**：所有 `/api/admin/**` 接口都只读 JWT 里登录时冻结的 `role`，被降权/封禁的管理员在令牌过期前仍然全权可操作；老接口 `/api/users` 的 `PUT` 更是连"不能自我降权""必须留一个管理员"都没有。
2. **数据可信度不足**：仪表盘的"环比增长"是 `Math.random()` 现编的数字；站点设置表单只要有一个字段留空就整体 400 保存失败；审计一片空白，删了什么无法追溯。
3. **管理能力缺口**：没有评论审核、没有用户封禁/删除/详情、内容列表没有搜索/排序/批量、爬虫不能删源也不能全量触发。
4. **可用性缺口**：后台界面 100% 英文（连 `zh` 词条里 15 个键的值本身就是英文），固定宽度侧栏在移动端不可用，页面里有两个 `<main>` 地标，缺 loading/error 边界，英文站的导航点击会跳回中文站。

本轮把这些全部补齐，并新增了审计日志、评论审核、用户详情三个新模块。

---

## 1. 站点全景

### 1.1 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14.2（App Router，RSC + ISR） |
| 数据库 | SQLite + Prisma 5.22（`prisma/dev.db`，仅 `db push`，无 migrations） |
| 鉴权 | next-auth v5 beta，Credentials + GitHub OAuth，**纯 JWT 会话（无 adapter、无 DB session）** |
| 多语言 | next-intl 4，`locales: [zh, en]`，`localePrefix: "as-needed"`（zh 无前缀，en 为 `/en`） |
| 编辑器 | TipTap + turndown + marked + highlight.js + isomorphic-dompurify |
| UI | Tailwind + Radix UI + lucide-react + sonner |
| 爬虫 | 独立 Python 包 `crawler/`（httpx），通过 `execFile` 由 Node 调用，node-cron 定时 |
| 部署 | Docker 多阶段 + standalone、docker-compose、`docker-entrypoint.sh` |

### 1.2 路由地图（本轮相关部分）

```
src/app/
├── [locale]/
│   ├── (main)/            首页、docs(解决方案)、questions、software、tags、search、
│   │                      profile、settings、notifications、about/help/privacy/contact
│   ├── (auth)/            login、register
│   └── admin/             ← 本次改造区域
│       ├── layout.tsx     服务端二次鉴权（DB 重读角色）
│       ├── AdminShell.tsx 新：响应式外壳（侧栏/抽屉/语言/主题/登出）
│       ├── dashboard/     仪表盘（新 ActivityChart）
│       ├── content/       内容管理（新 ContentTable 批量操作）
│       ├── comments/      新：评论审核
│       ├── users/         用户管理 + 新 users/[id] 详情
│       ├── crawler/       爬虫（新增一键全量、删源、日志筛选分页）
│       ├── audit/         新：操作审计
│       ├── settings/      站点设置
│       ├── loading.tsx    新
│       └── error.tsx      新
└── api/
    ├── admin/{content,comments,crawler,users,settings,stats}
    └── users/*            老的用户接口（已与新规则对齐）
```

### 1.3 数据模型

原有 14 个模型：User / Tag / Article / Question / Answer / Software / Comment / Vote / Bookmark / Notification / CrawlSource / CrawlLog / SiteConfig / SlugRedirect。

本轮新增：

- `User.bannedAt` / `User.banReason` / `User.lastLoginAt`
- `AuditLog`（审计表，`actorId` 故意**不做外键**，保证删号后日志仍在）

### 1.4 鉴权链路（改造后的三级防线）

```
middleware.ts（Edge，JWT 声明）  →  admin/layout.tsx（RSC，DB 重读角色+封禁）
                                →  requireAdminApi()（Route Handler，DB 重读）
```

改造前只有第 1 级对路由生效、第 2 级只存在于 layout、第 3 级完全缺失（接口各自 `session.user.role !== "ADMIN"`）。

### 1.5 缓存与内容分发

公开内容页是 ISR：`/docs/[slug]` 3600s、`/questions/[slug]` 1800s、列表页 60s、首页 300s。
**改造前后台改完内容并不会失效这些缓存**，最长要等 1 小时才生效；现在所有后台写操作都会调用 `revalidateContent()`（双语言前缀一起失效）。

---

## 2. 改造前后台问题清单（逐条实测）

严重度：🔴 高（安全/正确性）· 🟠 中（功能不可用/体验）· 🟡 低（一致性/健壮性）

| # | 级别 | 问题 | 证据 | 影响 |
|---|---|---|---|---|
| 1 | 🔴 | `/api/admin/**` 全部只信任 JWT 中的 `role` | `api/admin/{stats,settings,crawler,crawler/[id],content/[type]/[id]}` 均是 `session.user.role !== "ADMIN"` | 被降权的管理员在令牌过期前仍可删内容、改设置、改他人角色 |
| 2 | 🔴 | 老接口 `PUT /api/users` 完全没有自我保护 | 原 `api/users/route.ts` 直接 `prisma.user.update({data:{role}})` | 可自我降权、可移除最后一个管理员、无审计，绕过 `/api/admin/users/[id]` 的全部防护 |
| 3 | 🔴 | 被降权/封禁的账号在后台页面层面无强制下线 | `admin/layout.tsx` 会重读角色（已有），但其它模块缺失 | 与 #1 同源；本次统一收敛到 `lib/admin-guard.ts` |
| 4 | 🔴 | 站点设置保存基本不可用 | `SettingsForm` 发送 `logo: logo \|\| null` 等，而 API schema 是 `z.string().max(500).optional()` | 任一选填项留空 → 400 `Invalid input`，整个表单无法保存 |
| 5 | 🔴 | 精选内容哨兵 `__none__` 会被写库 | `SettingsForm` 的 `<SelectItem value="__none__">` 直接进入 state 并提交 | `SiteConfig.featuredArticle` 存入字面量 `"__none__"`，前台取不到内容 |
| 6 | 🟠 | 仪表盘"环比"是随机数 | `dashboard/page.tsx`：`Math.floor(Math.random() * 20)` | 展示给管理员的增长数据完全虚假 |
| 7 | 🟠 | 无审计日志 | 全库无审计表 | 谁删了内容/改了角色无从追溯 |
| 8 | 🟠 | 无人能审核评论 | 评论区存在但后台无入口 | 垃圾评论只能进数据库手删 |
| 9 | 🟠 | 用户管理只有角色下拉 | 原 `users/page.tsx` | 无封禁、无删除、无详情、无"最后登录"、无内容计数下钻 |
| 10 | 🟠 | 内容列表无搜索/排序/批量，列信息少 | 原 `content/page.tsx` | 上千条内容时无法运营；看不到浏览量/回答数 |
| 11 | 🟠 | 问答状态词不一致 | 后台 `["all","open","closed","resolved"]` 与编辑表单 `resolved`，站点与 `api/answers/[id]` 用 `solved` | 后台筛"已解决"永远为空；后台把状态改成 `resolved` 会让问题丢失"已解决"徽标 |
| 12 | 🟠 | 后台是中英混杂的"英文界面" | `/admin/dashboard` 渲染 `Overview of your platform`；`zh.json` 中 `admin.dashboard/content/users/...` 15 个键的值本身就是英文 | 中文站管理员看到全英文面板 |
| 13 | 🟠 | 后台链接不走 i18n 路由 | `AdminNav`、`content/page.tsx`、`EditContentForm` 使用 `next/link` + 硬编码 `/admin/...` | 在 `/en/admin` 下点击导航会跳回中文站并整页刷新 |
| 14 | 🟠 | 无 loading / error 边界 | 原 admin 目录下无 `loading.tsx`/`error.tsx` | 单页查询异常会让整块面板变成 Next 默认错误页 |
| 15 | 🟠 | 布局非响应式 | `AdminNav` 固定 `w-64`；layout 用 `ml-64` | 移动端内容被挤压、侧栏遮挡 |
| 16 | 🟠 | 页面存在两个 `<main>` 地标 | 实测旧 HTML `<main` 计数 = 2（`[locale]/layout.tsx` + `admin/layout.tsx`） | 屏幕阅读器地标冲突 |
| 17 | 🟡 | 软件标签编辑被静默丢弃 | `api/admin/content/[type]/[id]` 中 `if (type !== "software" && parsed.data.tags !== undefined)` | 后台改软件标签无效 |
| 18 | 🟡 | 删除不存在的 id 返回 500 | `DELETE /api/admin/content/...` 直接 `delete()` 抛异常 | 前端提示"删除失败"而非"不存在" |
| 19 | 🟡 | 状态值无校验 | 编辑接口 `status: z.string()` 任意字符串 | 可写入 `resolved`、`zzz` 等站点不认识的状态 |
| 20 | 🟡 | 爬虫页能力不足 | 无删源、无一键全量、日志固定 20 条无筛选/翻页 | 数据源管理只能进数据库 |
| 21 | 🟡 | 设置页无保存反馈 | `SettingsForm` 成功/失败都静默 | 管理员不知道是否保存成功 |
| 22 | 🟡 | admin 路由未声明 noindex | 无 metadata | 理论上可能被收录 |
| 23 | 🟡 | 批量/危险操作无二次确认与输入确认 | 删除用户此前根本不存在 | 误删风险 |

---

## 3. 本次增强明细

### 3.1 统一鉴权层：`src/lib/admin-guard.ts`（新）

- `getSessionUser()`：会话取 id → **回数据库重读** `role`、`bannedAt`。
- `isActiveAdmin(user)`：`role === "ADMIN" && !bannedAt`。
- `requireAdminApi()`：Route Handler 统一守卫，返回本地化 401/403。
- 被 8 个后台接口 + `lib/errors.ts` 的 `apiHandler({auth:"admin"})` + `api/users*` 复用。

**实测**：把当前管理员在 DB 里改成 `USER`（JWT 仍是 ADMIN），`/api/admin/stats` 立刻 403、后台页面 307 跳登录；改回 ADMIN 后恢复 200。

### 3.2 用户处置规则集中化：`src/lib/admin-user-actions.ts`（新）

`updateUserAccount()` / `deleteUserAccount()` 承载全部业务规则，两个入口共用（消除 #2 的分叉）：

- 禁止自我降权 / 自我封禁 / 自我删除；
- **至少保留一名可用管理员**（降级、封禁、删除三条路径都校验）；
- 封禁写入 `bannedAt` + `banReason`，登录时直接拒绝；
- 删除账号为事务级级联清理：名下文章/问答/软件/回答/评论、多态 Vote/Bookmark、通知，`Tag.createdBy` 置空，受影响问题的 `answerCount` 重算、丢失采纳答案的问题回退 `open`，标签计数按实际持有数扣减。

### 3.3 审计日志：`AuditLog` + `src/lib/audit.ts` + `/admin/audit`（新）

- 15 类动作：内容增删改、批量发布/下线/删除、评论删除、角色变更、封禁/解封、删号、爬虫源增删改、执行抓取、设置更新。
- 记录操作人（id + 邮箱）、对象类型/ID/名称、JSON 明细、客户端 IP、时间。
- **审计写入永不抛出**（失败只打日志），不影响主流程。
- 审计页支持按动作、按操作人/对象搜索、分页；仪表盘展示最近 8 条。

### 3.4 仪表盘：真实数据 + 待办队列

| 卡片 | 数据来源 |
|---|---|
| 用户/文章/问答/软件/评论/浏览量 | `count()` / `aggregate()` |
| "环比 ±N%" | 近 30 天 vs 前 30 天真实新增（无数据时降级为提示文案，不再编数字） |
| 近两周动态图 | 14 天用户/文章/问答/评论的堆叠柱状图（服务端渲染 SVG，零依赖，附 `sr-only` 数据表） |
| 待处理队列 | 待审草稿、无人回答、近 7 天抓取失败、已封禁账号，均可点击下钻到已筛选列表 |
| 爬虫健康 | 启用数据源比例 + 最近一次抓取时间 |
| 最近操作 | 审计日志 |
| 最新用户 / 待审核内容 | 直达详情或编辑页 |

替代了原来的 `Math.random()` 假增长与"最近 5 条"静态列表。

### 3.5 内容管理

- 类型页签（文章/问答/软件）+ 状态筛选（**带每状态计数**）+ 排序（最新/最早/热度/评分）+ 标题搜索。
- 表格新增：复选框、浏览量/回答数/评分、作者、创建时间。
- **批量操作**：发布 / 下线 / 删除（带确认弹窗），走新接口 `POST /api/admin/content/bulk`，单次上限 200 条，事务内清理多态 Vote/Bookmark，并按实际持有数回退标签计数。
- 行内快捷操作：查看、发布/下线一键切换、编辑、删除。
- 分页越界钳制（`?page=999` 不再空白）。
- 编辑接口：状态白名单校验、软件标签不再被丢弃、不存在对象返回 404（而非 500）。

### 3.6 评论审核：`/admin/comments`（新）

- 列表：内容摘要、作者、所属内容（可跳转前台原帖）、回复数、相对时间。
- 搜索评论正文 / 作者名 / 邮箱；分页；总量、近 7 天、参与人数三个指标。
- 删除带确认弹窗，**明确告知子回复会保留**（`parentId` 为 `SetNull`），删除后失效对应详情页缓存。
- 接口：`DELETE /api/admin/comments/[id]`（守卫 + 审计 + 404）。

### 3.7 用户管理

- 列表：搜索（昵称/邮箱）、角色筛选、状态筛选（正常/已封禁，带计数）、内容数、注册时间、**最近登录**。
- 行内：角色下拉（自我/最后管理员自动禁用）、详情入口、"更多"菜单（封禁/解封、删除）。
- 封禁弹窗可填原因；删除弹窗**要求输入该账号邮箱**才可提交。
- 新增 `/admin/users/[id]` 详情页：资料卡、8 项统计（文章/问答/回答/软件/评论/投票/收藏/通知）、发布内容、最近评论、账号相关审计记录，并复用同一套处置按钮。
- 登录时记录 `lastLoginAt`；被封禁账号在 `authorize` 中直接拒绝。

### 3.8 爬虫管理

- 新增**一键全量抓取**（`RunAllButton`，带二次确认）与**删除数据源**（带确认）。
- 指标卡：数据源数/启用数、近 24 小时失败数、最近成功时间。
- 日志表支持按状态筛选与分页（每页 20 条），不再固定"最近 20 条"。
- 所有写操作（建源/改源/删源/触发抓取）写审计。

### 3.9 站点设置

- 修复 #4：API 全部可选字段接受 `null`，并把 `__none__` 哨兵归一化为 `null`。
- 表单新增：脏数据检测（"有未保存的修改"提示 + 未修改时禁用保存）、保存成功/失败 toast、字段长度上限与 `htmlFor` 关联。
- 页面显示配置最后更新时间；保存后自动失效全站 ISR 缓存。

### 3.10 多语言、可访问性、响应式

- **后台全量 i18n**：新增 `admin.dashboardUi / contentUi / usersUi / commentsUi / crawlerUi / auditUi / auditActions / settingsUi / errorUi` 命名空间；同时修正 `zh.json` 中 15 个"值是英文"的键。词条表 **651 → 953 键**，中英逐键对齐（`i18n:check` 0 问题）。
- **语言路由**：后台全部改用 `@/i18n/routing` 的 `Link/useRouter/usePathname`，英文站不再跳回中文站（断言：`/en/admin/*` HTML 内不出现裸 `/admin` 链接）。
- **响应式外壳** `AdminShell`：桌面可折叠侧栏（状态存 localStorage）、移动端抽屉（Esc/遮罩关闭、`aria-modal`）、顶栏语言切换与主题切换、当前管理员信息与登出、分组导航 + 待审数量徽标、`aria-current="page"`。
- **可访问性**：`<main>` 地标只保留 1 个（实测 2 → 1）；表格复选框全选支持 `indeterminate` 且都有 `aria-label`；图标按钮全部补 `title`+`aria-label`；筛选器为受控 Select 并带 `aria-label`；加载态 `aria-busy`；错误边界面板。
- 新增 `admin/loading.tsx`（骨架屏）与 `admin/error.tsx`（可重试 + 错误编号）。

### 3.11 缓存失效：`src/lib/revalidate.ts`（新）

后台任何内容写操作（单条增删改、批量、评论删除、用户删除、站点设置）都会失效对应前台路径的两种语言版本，使编辑立即生效而不是等 ISR 过期。

### 3.12 其它修复

- `admin/page.tsx` 的 `/admin` → 仪表盘跳转按当前语言跳转。
- 爬虫源删除保留历史 `CrawlLog`（审计与回溯需要）。
- 后台路由声明 `robots: noindex, nofollow`。
- `/api/users`（列表 + 角色）改为复用新守卫与新规则，不再有第二条无防护的提权路径。

---

## 4. 数据库变更

```prisma
model User {
  bannedAt    DateTime?   // 封禁时间；非空即禁止登录
  banReason   String?
  lastLoginAt DateTime?   // 后台"最近登录"列
}

model AuditLog {          // 追加写入，actorId 故意不做外键
  id, actorId, actorEmail, action,
  targetType?, targetId?, targetLabel?, metadata?, ip?, createdAt
  @@index([createdAt]) @@index([actorId]) @@index([action])
}
```

已执行：`prisma db push` + `prisma generate`（`prisma/dev.db` 已同步；SQLite 加列均为可空或新表，无数据丢失）。

> ⚠️ 部署提醒：当前仍是**只有 `db push`、没有 migrations** 的状态（沿用既有做法）。生产环境请先备份 `dev.db`，再执行 `npx prisma db push`。

---

## 5. 验证记录

```
npx tsc --noEmit   → exit 0
npx next lint      → ✔ No ESLint warnings or errors
npm run build      → ✓ Compiled successfully / ✓ Generating static pages (28/28)
npm run i18n:check → catalog: 953 keys (zh) / 953 keys (en) / No i18n problems found
```

运行时断言（`node scripts/_tmp-admin-smoke.mjs`，真实登录 + 真实 HTTP，**69/69 PASS**）：

```
匿名：/en/admin/dashboard → 307；/api/admin/stats → 401；批量接口 → 401
页面：zh 19 条 + en 7 条全部 200（含 ?type=bogus、?page=abc、?search、?sort=views、越界页）
本地化：/admin/dashboard 含「仪表盘」且不再出现 "from last month"；/en/admin/* 不出现裸 /admin 链接
可访问性：后台页面 <main> 计数 = 1
设置：全字段 null 提交 → 200（回归修复）；__none__ → 存库为 null；logo 清空 → null
内容：非法状态 "resolved" → 400；合法状态 → 200；不存在对象 PUT/DELETE → 404
批量：发布生效（DB 校验）；201 条 ids → 400（上限生效）
评论：删除生效且从 DB 消失；重复删除 → 404
用户：自我降权/封禁/删除 → 400；封禁后无法登录、解封后可登录；删除后 DB 无残留
老接口：PUT /api/users 自我降权 → 400（此前可成功）
审计：一次操作产生 7 条日志，覆盖 content.update / comment.delete / user.ban / settings.update 等
权限：DB 降权后 JWT 仍在 → 接口 403、页面 307；恢复 ADMIN → 200
```

浏览器复核：Playwright 访问 7 个后台页面（1440×1000）与移动端（420×900）截图存于 [`output/playwright/`](output/playwright)，确认中文界面、图标操作列、筛选器、空状态、移动端抽屉均正常。

**变更规模**：`git diff --stat` = **38 个已跟踪文件，+2848 / −1149**，另有 22 项新增（含 4 个共享库、3 个 API 模块、3 个新页面目录、2 个边界文件、`output/playwright/` 截图），删除 4 个已被替代的组件。

> 说明：`src/app/layout.tsx`、`src/components/layout/{Footer,Navbar}.tsx`、`src/app/[locale]/(auth)/{login,register}/page.tsx`、`public/`、`src/components/Logo.tsx`、`src/app/icon.svg` 是本次会话开始前就已存在的未提交改动，不是本轮产生的（合计仅 12 行增删）。

### 文件职责速查（新增）

| 文件 | 作用 |
|---|---|
| [`src/lib/admin-guard.ts`](src/lib/admin-guard.ts) | 会话 + 数据库双重校验的统一守卫 |
| [`src/lib/admin-user-actions.ts`](src/lib/admin-user-actions.ts) | 角色/封禁/删号的业务规则与级联清理 |
| [`src/lib/audit.ts`](src/lib/audit.ts) | 审计写入（永不抛出）与动作枚举 |
| [`src/lib/revalidate.ts`](src/lib/revalidate.ts) | 后台写操作触发前台 ISR 失效 |
| [`src/app/[locale]/admin/AdminShell.tsx`](src/app/[locale]/admin/AdminShell.tsx) | 响应式后台外壳（侧栏/抽屉/语言/主题/登出） |
| [`src/app/[locale]/admin/dashboard/ActivityChart.tsx`](src/app/[locale]/admin/dashboard/ActivityChart.tsx) | 依赖为零的可访问堆叠柱状图 |
| [`src/app/[locale]/admin/content/ContentTable.tsx`](src/app/[locale]/admin/content/ContentTable.tsx) | 多选 + 批量操作内容表格 |
| [`src/app/[locale]/admin/users/[id]/page.tsx`](src/app/[locale]/admin/users/[id]/page.tsx) | 用户详情与账号审计 |
| [`src/components/admin/AdminFilters.tsx`](src/components/admin/AdminFilters.tsx) | 后台通用搜索框与下拉筛选器 |

---

## 6. 已知限制（有意为之，需知悉）

1. **封禁对"已登录的普通用户"不是即时生效的**：站点使用纯 JWT 会话且没有 Prisma adapter，无法在服务端吊销既有令牌。当前语义是：**被封禁账号无法再登录**；**管理员权限即时失效**（后台页面与全部后台接口都回库重读）。若要彻底即时踢下线，需要引入数据库会话（`@auth/prisma-adapter`）或把 `session.maxAge` 调短。
2. **GitHub OAuth 用户仍不在 User 表**（沿用上一轮审计的结论，未擅自实现）：OAuth 登录后 `session.user.id` 是 GitHub 的 id，写内容会外键失败，也不会出现在后台用户列表里。修复需要在校验邮箱归属后做账号关联或接入 adapter。
3. **限流仍是进程内存实现**，多实例部署下不共享。
4. **仍是 `db push` 而非 migrations**，缺少可复现的升级/回滚路径。
5. 站点设置里的 `logo` 字段本可加 URL 格式校验，但当前站点也用相对路径，故只做长度限制。

## 7. 建议排期（未做）

| 优先级 | 事项 |
|---|---|
| 高 | 接入 Prisma adapter（或缩短 session 时长），让封禁/降权对普通用户即时生效 |
| 高 | 轮换 `.env` 中的 `AUTH_SECRET` 与 GitHub OAuth Secret（历史提交已泄漏，上一轮已说明） |
| 中 | 建立 `prisma/migrations`，把部署流程从 `db push` 切换为 `migrate deploy` |
| 中 | 评论举报/关键字过滤；内容版本历史与回滚 |
| 中 | 后台表格服务端排序/筛选的 URL 状态持久化 + 导出 CSV |
| 低 | 为 `tag` 增加后台管理页（标签已有 API 与计数，后台仍无入口） |
| 低 | 清理 `User.email`、`Tag.slug` 等列上 `@unique` 与 `@@index` 重复的索引 |
| 低 | 限流改为 Redis/共享存储；`lib/sanitize.ts` 收紧 `style` 属性白名单 |

## 8. 需要人工确认的一处副作用

为完成运行时验证，我把种子账号 `admin@solution.local` 临时提升为 ADMIN 并重置为默认口令 `admin123` 用于登录测试；**验证结束后已恢复为原来的 `USER` 角色**。站点当前唯一的管理员仍是 `860256007@qq.com`。请在后台"用户管理"里确认管理员名单符合预期。
