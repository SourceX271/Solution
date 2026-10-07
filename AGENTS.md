# 项目规范（Solution）

本文件是本仓库**唯一的常驻规范来源**，对 AI 助手与人类协作者同时生效，优先级高于模型默认习惯。
规范背后的机制解释、排查手册与历史结论都在 `docs/`（地图见 [docs/README.md](docs/README.md)）；
**两者冲突时以本文件为准**，并回头把文档改对。

适用范围：整个仓库（`src/`、`crawler/`、`prisma/`、`scripts/`、`public/`、`docs/`、Docker 与部署配置）。

---

## 〇、十条速记

1. **一次改动一次提交**，提交信息写清「改了什么、为什么」（中文）。
2. 提交前自检：`npx tsc --noEmit`、ESLint、`npm run i18n:check`；涉及运行时/路由/依赖再跑 `npm run build`。
3. 用户可见文案**一律走 next-intl**，`messages/zh.json` 与 `messages/en.json` 同时增删同键。
4. `/api/admin/**` **一律 `requireAdminApi()`**，不要只读 JWT 里的 `role`（它冻结在登录时刻）。
5. 后台写操作**必须写审计 + 失效前台 ISR**。
6. 改 schema 后 `prisma db push` + `generate`；**新增列必须可空或带默认值**。
7. 站内链接用 `@/i18n/routing` 的 `Link`/`useRouter`，不要用 `next/link` 拼绝对路径。
8. 任何 HTML 的入库与渲染都要过 `sanitizeHtml()`；上传走白名单 + magic byte 校验。
9. 临时产物不入库（`*.log`、`.tmp-*`、`.playwright-cli/`、`output/`）；**文档配图放 `docs/assets/`**。
10. 未经明确要求**不 `git push`**、不改写已推送历史（`--force` / `rebase` / `reset --hard`）。

---

## 一、提交节奏与自检

- **每完成一处改动就提交一次，不要攒批。** 改完一段 → 自检 → 立刻 `git commit`，再开始下一段。
- 一个提交只做一件事；提交信息写清「改了什么、为什么」，用中文即可。
- **每次提交前必须自检，全绿才提交**：

  ```bash
  npx tsc --noEmit        # 类型检查
  npx next lint           # ESLint（见下方环境限制）
  npm run i18n:check      # 中英词条对齐 + 无硬编码中文
  npm run build           # 涉及运行时/路由/依赖时必跑（先停掉 dev server）
  ```

- 自检口径：
  - **纯文档/资源改动**：至少跑 `npx tsc --noEmit` 与 `npm run i18n:check`，并在提交信息里说明未跑 `build`。
  - **改了源码/路由/依赖**：四项全跑；`build` 前必须先停 `npm run dev`（否则 `.next` 并发写入导致随机构建失败）。
  - 某项因**环境原因**跑不了，必须在提交信息或回复里说明，并尽量给出等价替代（见第四节）。
- 提交前先 `git status` 确认暂存范围；临时文件（`*.log`、`.tmp-*`、`scripts/_tmp-*`、`.playwright-cli/`、`output/`）不得入库。
- 未经明确要求**不要 `git push`**，也不要改写已推送的历史。

---

## 二、代码规范

### 2.1 目录、命名与类型

- 路径别名统一 `@/*` → `src/*`；不要出现多层 `../../` 相对引用。
- 文件命名：`src/lib/**` 与 `src/app/api/**` 用 **kebab-case**（`admin-guard.ts`、`crawler-ingest.ts`）；
  React 组件用 **PascalCase**（`VoteButtons.tsx`）；`src/components/ui/**` 原语用 **小写**（`button.tsx`）。
- App Router 只使用约定文件名：`page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `route.ts`。
- TypeScript **strict**；**不要新增 `any` 兜底**。仓库里仍有历史用法（`(session.user as any)`、`catch (err: any)`、
  `where: any`），新代码请用 `AuthSession`、`unknown` + 类型收窄，不要照抄。
- 格式化统一走 Prettier：`npm run format`（保留分号、单引号、2 空格缩进、尾逗号、Tailwind 类名排序）。
  ESLint 当前只启用 `next/core-web-vitals`。

### 2.2 多语言（强制）

- 任何用户可见文案都必须走 `next-intl`：服务端 `getTranslations(ns)` / 客户端 `useTranslations(ns)`；
  **禁止**在 `src/` 里新增硬编码中文（唯一的白名单在 `scripts/check-i18n.mjs`，只允许既有 5 个文件）。
- `messages/zh.json` 与 `messages/en.json` **同时增删同样的键**，命名空间沿用现有 23 个（新增子命名空间优先复用 `*Ui`）。
- API 的错误/提示消息用 `getApiT("api")`（消息语言由 `NEXT_LOCALE` cookie 决定）。
- zod 校验消息用工厂形式 `getXSchema(t)`（`src/lib/validations.ts`），不要在 schema 里写死中文。
- 通知消息存结构体 `{key, params}`（`createNotification`），渲染时才按读者语言翻译。
- 详细规范与自查命令见 [docs/i18n.md](docs/i18n.md)。

### 2.3 鉴权与授权

- 所有 `/api/admin/**` 用 `src/lib/admin-guard.ts` 的 `requireAdminApi()`（会话 + **回库**重读 `role`/`bannedAt`）。
- 后台页面兜底在 `src/app/[locale]/admin/layout.tsx`；新增后台页面不要自己写一套判定。
- 前台接口的「作者本人或管理员」判定，新增代码一律用 `getSessionUser()` + `isActiveAdmin()`，
  **不要**再读 `session.user.role`（历史遗留，见第七节欠账 2）。
- 用户相关的高危操作（改角色、封禁、删号）走 `src/lib/admin-user-actions.ts`，不要在路由里直接 `prisma.user.update`。
- 需要登录的接口用 `apiHandler({ auth: "required" })` 或显式 `auth()` 判断，未登录一律 401、无权限 403。

### 2.4 API 约定

- 动态段参数在 Next 15 下是 Promise：处理器内 `await ctx.params` / `await searchParams` 后再用。
- **新增接口的响应形状统一为 `{ success, data, … }`**（用 `apiHandler` + `successResponse` / `paginatedResponse`）；
  历史接口里 `{data,total,page,limit}` 与裸数组这两种形状**不要扩散**。
- 分页一律用 `getPaginationParams(req)` 与 `toPositiveInt()`，不要手写 `parseInt` 后直接当 `skip/take`。
- 请求体校验一律用 zod（`src/lib/validations.ts` 的工厂）；`req.json()` 必须容错（`.catch(() => null)`），
  非法 JSON 应返回 **400** 而不是 500。
- 限流用 `checkRateLimit(getRateLimitKey(req, suffix), …)`，新增写接口要有额度。
- 错误消息本地化；错误码语义保持：400 参数、401 未登录、403 无权限、404 不存在、409 冲突、429 限流。
- 状态字段只能写白名单值（文章 `published|draft`、问题 `open|solved|closed`、软件 `published|pending|draft`）。

### 2.5 数据库与计数

- SQLite + Prisma，**只有 `db push`、没有 migrations**：改 `prisma/schema.prisma` → `npx prisma db push` → `npx prisma generate`。
- **新增列必须可空或带默认值**，避免既有数据丢失；改 schema 后同步更新 [docs/data-model.md](docs/data-model.md)。
- 多表不变量必须放进 `prisma.$transaction`（例：投票 + 冗余计数、采纳答案 + 问题状态、删号级联清理）。
- **冗余计数字段**（`Question.answerCount/voteCount`、`Answer.voteCount`、`Software.rating/ratingCount`、`Tag.usageCount`）
  必须在同一事务内同步：标签走 `bumpTagUsage` / `syncTagUsage`（编辑换标签用后者），后台重算用 `recomputeTagUsage`。
- 删除内容时必须显式清理多态 `Vote`/`Bookmark`（`targetType + targetId`，数据库层无外键），
  并回退标签计数；新增内容类型时要同时更新白名单与各清理点。
- slug 一律用 `generateSlug()` 生成纯 ASCII 随机串，**不要**从标题派生；旧链接靠 `SlugRedirect` 表兜底。

### 2.6 缓存与审计

- 后台任何影响前台内容的写操作，必须调用 `src/lib/revalidate.ts` 的对应函数
  （`revalidateContent` / `revalidateContentList` / `revalidateSiteConfig` / `revalidateTags`）；它会同时失效 `zh` 与 `en`。
- 后台任何写操作必须写审计：`logAdminAction({ actor, action, targetType, targetId, targetLabel, metadata, req })`；
  新增动作要加进 `AuditAction` 枚举，并给 `AuditActionBadge` 补一个显式 `case`（保证 i18n key 静态可达）。

### 2.7 UI 与可访问性

- 复用 `src/components/ui/*`（Radix 封装）与 `src/components/admin/*`，不要重复造按钮/弹窗/表格。
- 图标按钮必须同时给 `title` 与 `aria-label`；表单控件要有 `htmlFor`/`id` 关联；开关类用 `aria-pressed`。
- 页面只能有一个 `<main>` 地标；加载态给 `aria-busy`；破坏性操作要有确认弹窗（删用户要求输入目标邮箱）。
- 交互组件放 `src/components/client/**` 并标 `"use client"`；服务端页面直接查 Prisma，不要为了少写一次查询而绕道自家 API。
- 文案、日期与相对时间都要按 locale 输出（`formatDate(date, locale)`、`formatRelativeTime(date, locale)`）。

### 2.8 安全

- 任何来自用户的 HTML：入库与渲染前都过 `sanitizeHtml()`；Markdown 先 `render` 再净化再高亮。
- 上传：MIME 白名单（jpeg/png/gif/webp）+ magic byte 嗅探 + 体积上限 + `randomUUID()` 文件名；**不接收 SVG**。
- 密钥只放 `.env`（已被 git 与 Docker 忽略）；**禁止**把任何密钥写进源码、提交信息或文档。
- 需要拼进 `dangerouslySetInnerHTML` 的结构化数据（如 JSON-LD）必须转义 `<`/`>`/`&`。
- 重定向参数只接受站内相对路径（防开放重定向）；执行外部命令一律 `execFile` + 参数数组 + 白名单。
- 详见 [docs/security.md](docs/security.md)。

### 2.9 错误处理与日志

- 服务端预期错误用 `AppError(statusCode, message)`（配合 `apiHandler` 统一转成响应）；不要吞掉错误后返回 200。
- 非关键副作用（审计、通知）按现有约定「失败只 `console.error`，不抛出」；关键写入失败必须让请求失败。
- 运维日志（如采集器 `CrawlLog.message`）可以用中文，但那是数据不是界面。

---

## 三、目录结构与职责

```
src/app/[locale]/    前台与后台页面（(main) 公开 / (auth) 登录注册 / admin 后台）
src/app/api/         REST 路由（41 个 route.ts）        → docs/api-reference.md
src/lib/             业务与基础设施（认证、守卫、审计、校验、限流、清洗、标签、缓存失效、采集入库）
src/components/      ui（Radix 封装）/ client（交互）/ layout / admin  共 46 个
src/i18n/            routing.ts（locales）与 request.ts（词条装载）
crawler/             Python 采集器（唯一入口 python -m crawler.main）  → docs/crawler.md
prisma/              schema.prisma、seed.ts、seed-redirects.ts         → docs/data-model.md
scripts/             check-i18n.mjs、check-i18n-runtime.mjs
messages/            zh.json / en.json（各 1009 键）
docs/                开发者文档；配图与复核截图在 docs/assets/，历史快照在 docs/archive/
public/              logo.svg 与运行时上传目录 uploads/（不入库）
```

Docker 与部署：`Dockerfile`、`docker-compose.yml`、`docker-entrypoint.sh` 在仓库根；
部署手册 [DEPLOY.md](DEPLOY.md)（Docker 形态）、[docs/permissions.md](docs/permissions.md)（裸机形态）、
[docs/operations.md](docs/operations.md)（实现侧事实与差异清单）。

---

## 四、环境约束（速查，详见 [docs/dev-environment.md](docs/dev-environment.md)）

| 约束 | 处置 |
|---|---|
| `npm run build` 前有 `next dev` 在跑 | 先停 dev server，`.next` 并发写入会让构建随机失败 |
| 用 PowerShell 改源码 | **禁止** `Set-Content`/`Out-File`（GBK 会永久损坏中文）；用编辑器工具或 `[System.IO.File]::WriteAllText()` |
| 路径含 `[locale]`、`[slug]` 等方括号 | `-Path` 会把方括号当通配符（静默跳过）；一律 `-LiteralPath`，搜索用 grep 工具 |
| 沙箱内 `npx next lint` 崩溃（`ERR_SWC_NATIVE_CACHE`） | 用 `npx eslint src --ext .ts,.tsx` 等价代替；官方命令请在普通终端跑 |
| 沙箱内 `git add/commit` 报 `index.lock: Permission denied` | `.git` 有显式 DENY ACE；git 写操作需在完全访问模式下执行 |
| 沙箱内 `prisma db push` / `tsx` 报 `spawn EPERM` | 在普通终端执行；或改用 Prisma Client 原生 SQL |
| Windows 上进程被强杀表现为 `exit code 1` | 那是中断，不是命令失败 |
| `.env`、`prisma/dev.db`、`public/uploads/**`、`.next/` | 运行期产物，不入库、不提交 |

---

## 五、文档规范

1. **改了代码就顺手改文档**：涉及路由 / 接口 / 模型 / 词条数 / 目录结构的变化，必须同步更新对应文档与速览数字。
2. **新增文档要登记**：在 [docs/README.md](docs/README.md) 第一节的对应分组加一行，必要时同步下方「文档索引」。
3. **数字要可核对**：文档里的计数（模型数、路由数、页面数、词条数）都应能从仓库直接数出来。
4. **历史结论进归档**：带日期的报告/快照放 `docs/archive/`，文首标注哪些内容已过时，不要直接删。
5. **配图统一放 `docs/assets/`**；不要再在仓库根新增 `output/`、`screenshots/` 这类工具目录。
6. **临时产物不入库**：`*.log`、`.tmp-*`、`scripts/_tmp-*`、`.playwright-cli/` 用完即删。

---

## 六、文档索引

全部文档的地图在 [docs/README.md](docs/README.md)（分层索引：入门 / 参考 / 质量与安全 / 运维 / 历史）。常用几份：

- [docs/README.md](docs/README.md) — 文档地图、项目速览与常用命令
- [docs/architecture.md](docs/architecture.md) — 架构总览与设计决策
- [docs/api-reference.md](docs/api-reference.md) — 接口全量参考
- [docs/data-model.md](docs/data-model.md) — 数据模型与计数约定
- [docs/i18n.md](docs/i18n.md) — 多语言规范与校验脚本
- [docs/admin-panel.md](docs/admin-panel.md) — 后台功能、鉴权与审计
- [docs/crawler.md](docs/crawler.md) — 采集器
- [docs/security.md](docs/security.md) — 安全模型与待处理风险
- [docs/operations.md](docs/operations.md) — 运行、部署事实与发布清单
- [docs/permissions.md](docs/permissions.md) — 裸机部署：权限基线、firewalld、更换 SQLite
- [docs/dev-environment.md](docs/dev-environment.md) — 环境陷阱与排查
- [docs/code-audit.md](docs/code-audit.md) · [docs/dependency-audit-2026-10.md](docs/dependency-audit-2026-10.md) — 审查与依赖审计结论
- [docs/archive/](docs/archive) — 历史快照（引用前先核对现状）
- [DEPLOY.md](DEPLOY.md) — 面向部署者的手册

---

## 七、已知欠账（接手先看；权威清单在 docs）

| # | 事项 | 权威说明 |
|---|---|---|
| 1 | **轮换 `AUTH_SECRET` 与 GitHub OAuth Secret**（旧值在 git 历史中） | [docs/security.md](docs/security.md) 第六、八节 |
| 2 | 前台内容写接口仍用 JWT 里的 `role` 做管理员旁路，降权后 token 过期前仍可操作 | [docs/security.md](docs/security.md) 第二节 |
| 3 | `/api-docs` 页面对外可见但内容已过期（列了不存在的端点），且是唯一硬编码中文的界面 | [docs/api-reference.md](docs/api-reference.md) 文首与第九节 |
| 4 | 前台内容 `DELETE`、评论/答案写操作未失效 ISR 缓存 | [docs/api-reference.md](docs/api-reference.md) 第九节 |
| 5 | [DEPLOY.md](DEPLOY.md) 与实现有 10 处不一致（采集间隔、`PYTHON_BIN`、`DATABASE_URL` 等） | [docs/operations.md](docs/operations.md) 第五节 |
| 6 | 无测试框架、无 CI；限流是进程内存；无 migrations；GitHub OAuth 用户不进 `User` 表 | [docs/architecture.md](docs/architecture.md) 第五节 |
| 7 | `public/og-image.png` 与 `/favicon.ico` 缺失；4 个无引用组件待清理 | [docs/frontend.md](docs/frontend.md) 第六节 |
