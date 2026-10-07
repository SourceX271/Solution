# 协作约定（Solution）

本文件是本仓库对 AI 助手/协作者的常驻约定，优先级高于模型的默认习惯。

## 一、提交节奏（最重要）

- **每完成一处改动就提交一次，不要攒批。** 改完一段 → 自检 → 立刻 `git commit`，再开始下一段。
- 一个提交只做一件事；提交信息写清"改了什么、为什么"，用中文即可。
- **每次提交前必须自检**，全绿才提交：

  ```bash
  npx tsc --noEmit                        # 类型检查
  npx next lint                           # ESLint
  npm run i18n:check                      # 中英词条对齐 + 无硬编码中文
  npm run build                           # 涉及运行时/路由/依赖时必跑（先停掉 dev server）
  ```

  若某项因环境原因无法运行，必须在提交信息或回复中说明。
- 未经明确要求**不要 `git push`**，也不要改写已推送的历史（`--force`、`rebase`、`reset --hard`）。
- 提交前先 `git status` 确认暂存范围，避免把临时文件（`*.log`、`.tmp-*`、`scripts/_tmp-*`、`.playwright-cli/`）带进提交。

## 二、写代码时的项目约定

- **多语言**：任何用户可见文案都必须走 `next-intl`，且 `messages/zh.json` 与 `messages/en.json` **同时**增删同样的键；`npm run i18n:check` 会强制校验（也会拦截 `src/` 下的硬编码中文）。后台/前台路由链接统一用 `@/i18n/routing` 的 `Link`/`useRouter`，不要用 `next/link` 直接写绝对路径。
- **鉴权**：`/api/admin/**` 一律用 `src/lib/admin-guard.ts` 的 `requireAdminApi()`，不要只信 JWT 里的 `role`（它冻结在登录时刻）；后台页面的兜底在 `src/app/[locale]/admin/layout.tsx`。
- **后台写操作**：都要写审计（`src/lib/audit.ts` 的 `logAdminAction`）并在影响前台内容时调用 `src/lib/revalidate.ts` 失效 ISR 缓存。
- **数据库**：SQLite + Prisma，目前只有 `db push`（无 migrations）；改 schema 后执行 `npx prisma db push` 并重新 `generate`。新增列务必可空或带默认值，避免丢数据。
- **UI**：复用 `src/components/ui/*`（Radix 封装）与 `src/components/admin/*`；图标按钮必须同时给 `title` 和 `aria-label`。

## 三、环境陷阱（详见 docs/dev-environment.md）

- `npm run build` 前**必须先停掉 `npm run dev`**，否则 `.next` 并发写入会导致随机构建失败。
- 不要用 PowerShell 的 `Set-Content`/`Out-File` 改写源码（默认编码会损坏中文），也不要手写文件字节；用编辑器工具或 `[System.IO.File]::WriteAllText()`。
- 沙箱下 `node` 的管道 stdio 可能报 `spawn EPERM`；Windows 上被强杀的进程表现为 `exit code 1`（那是中断，不是失败）。

## 四、文档索引

全部文档的地图在 `docs/README.md`（分层索引：入门 / 参考 / 运维 / 历史）。常用几份：

- `docs/README.md` — 文档地图、项目速览与常用命令
- `docs/code-audit.md` — 代码审查结论（已修复 / 待处理）
- `docs/dependency-audit-2026-10.md` — 依赖安全审计修复报告（97 → 7，含残留风险说明）
- `docs/dev-environment.md` — 环境陷阱与排查
- `docs/permissions.md` — 裸机部署：文件权限基线、firewalld 放行、在服务器上更换 SQLite 数据库
- `docs/archive/` — 历史快照：`AUDIT-REPORT.md`（2026-09-30 全站审计）、
  `ADMIN-PANEL-ENHANCEMENT-2026-10.md`（2026-10-04 后台增强）；均为当时结论，引用前先核对现状
- `DEPLOY.md`（仓库根目录）— 面向部署者的手册（环境要求、Nginx/SSL、备份、更新、排障）
