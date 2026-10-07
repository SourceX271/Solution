# Solution 文档地图

本目录是 **Solution 项目开发者文档的唯一入口**。面向开发者与协作者；面向部署者的手册仍是仓库根目录的
[DEPLOY.md](../DEPLOY.md)。

> **命名提醒**：`src/app/[locale]/(main)/solutions/` 是网站前台的「解决方案」页面路由（URL `/solutions`），
> 与本目录无关。该路由原名 `docs/`（URL `/docs`），2026-10-05 更名；旧 URL 由 `next.config.mjs` 的
> `redirects()` 以 308 永久重定向，历史链接与收录不受影响。

---

## 一、文档地图

### 入门

| 文档 | 内容 |
|---|---|
| **README.md**（本文） | 文档地图、项目速览、常用命令、排查指南 |
| [architecture.md](./architecture.md) | 架构总览：技术栈、目录地图、三条主链路（读/写/采集）、关键设计决策、现存不一致 |
| [frontend.md](./frontend.md) | 路由与页面清单、middleware 守卫矩阵、47 个组件、SEO 与元数据、已知行为差异 |

### 参考

| 文档 | 内容 |
|---|---|
| [data-model.md](./data-model.md) | 15 个 Prisma 模型、关系、状态机、多态关联、冗余计数、索引与操作约定 |
| [api-reference.md](./api-reference.md) | 41 个路由文件的 66 个导出处理方法：鉴权、入参、响应、副作用、限流、已知坑 |
| [i18n.md](./i18n.md) | 多语言接线、24 个命名空间 / 1040 键、两个校验脚本的规则、新增词条与语言的流程 |
| [admin-panel.md](./admin-panel.md) | 后台 8 个模块、三级鉴权、用户处置规则、19 类审计动作、缓存失效矩阵、开发约定 |
| [crawler.md](./crawler.md) | Python 采集器：CLI、7 个数据源、请求行为、入库与去重、定时调度、合规风险 |

### 质量与安全

| 文档 | 内容 |
|---|---|
| [security.md](./security.md) | 认证与授权分层、输入清洗白名单、CSP 与响应头、密钥现状、依赖漏洞状态、待处理清单 |
| [code-audit.md](./code-audit.md) | 代码审查结论：13 项已修复（含根因与验证方式）+ 待处理问题（按优先级） |
| [dependency-audit-2026-10.md](./dependency-audit-2026-10.md) | 依赖安全审计修复报告：97 → 7 的逐项处置、唯一残留风险（`braces`）的理由与监控条件、升级引入的行为变更、验证证据 |
| [audit-report.txt](./audit-report.txt) · [npm-audit-after-fix.txt](./npm-audit-after-fix.txt) | 依赖审计的**修复前 / 修复后基线快照**（原始 `npm audit` 输出，供对照复核） |

### 运维

| 文档 | 内容 |
|---|---|
| [operations.md](./operations.md) | 环境变量、本地起步、数据库、构建自检、Docker 实现侧事实、与 DEPLOY.md 的差异清单、发布检查清单 |
| [permissions.md](./permissions.md) | 裸机部署三件事：**文件权限基线**（目录 755 / 文件 644 / `.env` 600）、**firewalld 放行与外部验证**、**在服务器上更换 SQLite 数据库**（结构漂移比对 → 原子替换 → 校验），含 Windows 同步破坏权限位的症状与修复命令 |
| [dev-environment.md](./dev-environment.md) | 环境陷阱：并发构建冲突、PowerShell 中文编码损坏、ACL/spawn 限制、非法 UTF-8 字节、`next lint` 与 `.git` 的沙箱限制 |
| [DEPLOY.md](../DEPLOY.md)（根目录） | 部署手册：环境要求、Docker 部署、Nginx/SSL、备份、更新、排障、默认管理员 |

### 历史归档（快照，勿当现状）

| 文档 | 说明 |
|---|---|
| [archive/AUDIT-REPORT.md](./archive/AUDIT-REPORT.md) | 2026-09-30 全站审计与修复报告（40 项修复，含 12 项严重安全问题） |
| [archive/ADMIN-PANEL-ENHANCEMENT-2026-10.md](./archive/ADMIN-PANEL-ENHANCEMENT-2026-10.md) | 2026-10-04 管理后台分析与增强报告（23 项实测问题 + 12 项增强） |

两份归档都已在文首标注**哪些数字与路由名已过时**；引用前请先核对现状，或以 [code-audit.md](./code-audit.md) 为准。

---

## 二、项目速览

| 层 | 技术 |
|---|---|
| 框架 | Next.js 15.5（App Router，`output: "standalone"`）+ React 19 |
| 语言 | TypeScript 5.4（strict） |
| 数据库 | SQLite + Prisma 5（`prisma/schema.prisma`，**15 个模型**，只有 `db push`） |
| 认证 | NextAuth v5 beta：GitHub OAuth + 邮箱密码（bcrypt 12 轮），纯 JWT 会话 |
| 国际化 | next-intl 4（zh / en，`localePrefix: as-needed`，各 1054 键） |
| UI | Tailwind CSS 3 + Radix（shadcn 风格）+ lucide-react + Tiptap 3 富文本 + KaTeX 公式 + sonner |
| 爬虫 | Python 3 + httpx + BeautifulSoup/lxml（`crawler/`，7 个数据源） |
| 部署 | Docker 多阶段构建 + Nginx + SQLite 数据卷 |

内容类型：**解决方案（Article）**、**问答（Question/Answer）**、**软件推荐（Software）**，
均支持标签、投票/评分、评论（嵌套回复）与收藏；另有通知、审计与审核态（草稿）。

关键目录：

```
src/app/[locale]/     前台页面（(main) 公开 / (auth) 登录注册 / admin 后台），共 33 个 page.tsx
src/app/api/          REST 路由，41 个 route.ts / 66 个导出方法 → api-reference.md
src/lib/              认证、守卫、审计、校验、限流、清洗、标签、缓存失效、采集入库
src/components/       ui（Radix 封装）/ client（交互）/ layout / admin，共 47 个
crawler/              Python 爬虫（入口 crawler/main.py，必须 python -m crawler.main）
prisma/               schema、seed、旧 slug 重定向脚本
scripts/              check-i18n.mjs、check-i18n-runtime.mjs
docs/                 本目录（配图与复核截图在 docs/assets/）
```

---

## 三、常用命令

```bash
npm run dev          # 开发服务器（端口 3000）
npm run build        # 生产构建（⚠️ 需先停掉 dev server，见 dev-environment.md 第 1 节）
npm run lint         # ESLint（= next lint）
npx tsc --noEmit     # 类型检查（增量缓存写 .next/cache/tsconfig.tsbuildinfo）

npm run i18n:check          # 中英词条对齐 + 无硬编码中文（秒级，提交前必跑）
npm run i18n:check:runtime  # 对运行中的服务做语言泄漏检查（默认 http://127.0.0.1:3103）
npm run math:check          # LaTeX 渲染管线回归（18 个用例，见 frontend.md「公式」）

npm run db:push      # 同步 Prisma schema 到数据库
npm run db:seed      # 导入种子数据
npm run db:studio    # Prisma Studio
npm run crawler:run  # 手动运行爬虫（等价于 python -m crawler.main）
```

爬虫可选参数（必须从仓库根目录执行）：

```bash
python -m crawler.main --list                     # 列出可用数据源（输出到 stderr）
python -m crawler.main --source devto --limit 3   # 只跑单个源
python -m crawler.main --format jsonl             # 每行一条 JSON
```

> 必须用 **`python -m crawler.main`**，不能用 `python crawler/main.py`（后者 `ModuleNotFoundError`）。

---

## 四、定时爬取

爬虫由 `src/instrumentation.ts` → `src/lib/crawler-scheduler.ts` 通过 `node-cron` 定时触发，
间隔取 `CRAWLER_INTERVAL_HOURS`（**实际被夹在 1–23 小时**），**仅在生产环境（`NODE_ENV=production`）注册**。

> 定时逻辑必须留在 `crawler-scheduler.ts` 这类独立模块里，由 `instrumentation.ts` 在
> `NEXT_RUNTIME === "nodejs"` 的分支**内部**动态引入。应用存在 Edge middleware（next-intl）时，
> Next 会把 `instrumentation` 同时编译给 Edge runtime，而 webpack 只在 `if` 死分支内丢弃动态
> import——写成「早退 `return` + 顶层 import」会让 `node-cron` / `child_process` 进入 Edge 包，
> 构建直接失败。

抓取到的内容以 `status: "draft"` 入库（审核态），需在管理后台 `/admin/content` 审核后才公开；已存在的
`sourceUrl` 会自动跳过。详见 [crawler.md](./crawler.md)。

---

## 五、站点资源与证据文件

| 文件 | 用途 | 说明 |
|---|---|---|
| `public/logo.svg` | 站点 logo | 已移除原稿白色底板，viewBox 收紧至图形边界 `225.7 245 512 512` |
| `src/app/icon.svg` | 浏览器图标 | 由 App Router 文件约定自动注入 `<link rel="icon">`，无需在 metadata 中配置 |
| `src/components/Logo.tsx` | logo 组件 | 尺寸用 `className` 控制（导航 `h-8`、页脚 `h-9`、登录/注册 `h-10`、后台 `h-7`） |
| `docs/audit-report.txt` · `docs/npm-audit-after-fix.txt` | 依赖审计基线 | 分别为修复前 / 修复后的 `npm audit` 原始输出，供 [dependency-audit-2026-10.md](./dependency-audit-2026-10.md) 对照 |
| `docs/assets/playwright/*.png` | 后台复核截图 | 8 张（含移动端），被归档的后台增强报告引用 |
| `docs/assets/publish-*.png` | 发布页界面截图 | `/questions/ask` 与 `/solutions/new` 各 1 张（1440×1000），见 [frontend.md](./frontend.md) 第二节 |
| `docs/assets/editor-math.png` · `docs/assets/math-rendered.png` | 公式功能截图 | 编辑器内的 LaTeX 节点与详情页的服务端渲染效果，见 [frontend.md](./frontend.md)「公式」小节 |

> ⚠️ 两个已知的资源缺口：`public/og-image.png` **不存在**，但根 layout 与 `[locale]/layout.tsx` 共引用 4 次
> （社交分享图会 404）；`/favicon.ico` 同样没有（标签页图标靠 `icon.svg`，浏览器请求 `/favicon.ico` 会 404）。

---

## 六、排查指南

| 现象 | 先看 |
|---|---|
| `git status` 一大堆改动，但 `git diff --numstat` 几乎为 0 | [permissions.md](./permissions.md) 第二节——从 Windows 同步过来的树丢了 Unix 权限位（`100644 → 100755`），按第三节修复 |
| `find ... $PRUNE` 报 `路径必须在表达式之前："\)"` 却「看起来执行成功」 | [permissions.md](./permissions.md) 第三节坑 1——变量展开丢失转义 + `xargs -r` 静默吞空输入 |
| 日志同时出现 `MissingSecret` 与 `Environment variable not found: DATABASE_URL` | [permissions.md](./permissions.md) 第五节——同源，都是 `.env` 没被加载；此时鉴权 fail-closed，登录会一直弹回 `/login` |
| 端口放行了但外部连不上，或分不清「进程没起」还是「防火墙没放」 | [permissions.md](./permissions.md) 第八节——外部验证必须在另一台机器上做，`curl 127.0.0.1` 不作数 |
| 要把别处的 `dev.db` 换到服务器上 | [permissions.md](./permissions.md) 第九节——SQLite 无 migrations，先用 `prisma migrate diff` 比对结构漂移再原子替换 |
| 换库后数据都在，头像却全 404 | [permissions.md](./permissions.md) 第九节——上传文件不在库里，需单独同步 `public/uploads/` |
| 构建随机失败（`middleware-manifest.json` 缺失、`/_document` 找不到、`copyfile ENOENT`） | [dev-environment.md](./dev-environment.md) 第 1 节——并发构建冲突 |
| 构建报 `Module not found: Can't resolve 'child_process' / 'path'`，导入链指向 `src/instrumentation.ts` | 本文第四节——Node-only 代码必须在 `NEXT_RUNTIME === "nodejs"` 分支内部动态导入 |
| `npx next lint` 崩溃：`SWC native addon: secure cache directory … 拒绝访问` / `ERR_SWC_NATIVE_CACHE` | [dev-environment.md](./dev-environment.md) 第 8.1 节——沙箱限制；改用 `npx eslint src --ext .ts,.tsx` |
| `git add/commit` 报 `Unable to create .git/index.lock: Permission denied` | [dev-environment.md](./dev-environment.md) 第 8.2 节——`.git` 被沙箱显式拒绝写，需要完全访问模式 |
| `next start` 报 `does not work with "output: standalone"` | 预期行为；生产用 `node .next/standalone/server.js`，本地冒烟测试可忽略该警告 |
| 源码中文乱码 / `invalid UTF-8` | [dev-environment.md](./dev-environment.md) 第 2、6 节 |
| `SetNamedSecurityInfoW failed`、`pwsh` 无法启动 | [dev-environment.md](./dev-environment.md) 第 4 节 |
| `prisma db push` / `tsx` 报 `spawn EPERM` | [dev-environment.md](./dev-environment.md) 第 5 节 |
| GitHub 登录报 `redirect_uri is not associated with this application` | GitHub OAuth App 的 Redirect URI 需与访问环境精确匹配（本地 `http://localhost:3000/api/auth/callback/github`，线上 `https://<域名>/api/auth/callback/github`），两者都要注册 |
| 旧链接（含中文的 slug）404 | `SlugRedirect` 表记录映射，详情页自动 308；新增映射见 `prisma/seed-redirects.ts` |
| 爬虫「0 条」 | [crawler.md](./crawler.md) 第六节——多为目标站点改版或反爬（无 JS 渲染） |
| 部署后改了内容前台没变 | 后台写操作会失效 ISR；前台自己的写接口（尤其 DELETE）**不会**，见 [api-reference.md](./api-reference.md) 第九节 |

---

## 七、文档维护约定

> 本节是提要；**强制要求与「改动 → 文档」映射表在 [AGENTS.md](../AGENTS.md) 第五节**，两者冲突以 AGENTS.md 为准。

1. **改了代码就必须同步改文档**：凡命中 AGENTS.md 第五节映射表的改动，都要在**同一个提交**里更新对应文档
   与本文的速览数字，提交信息写明同步了哪些文档。
2. **新增文档要登记**：在本文第一节的对应分组里加一行（含一句话说明），必要时也在 `AGENTS.md` 的「文档索引」里提一句。
3. **数字要可核对**：文档里出现的计数（模型数、路由数、词条数、页面数）都应能从仓库直接数出来；
   `i18n:check` 的输出、`Get-ChildItem -Recurse -Filter page.tsx` 都是可复现的来源。
4. **历史结论进归档**：带日期的报告/快照放入 `docs/archive/`，并在文首标注哪些内容已过时；
   不要直接删——审计与决策链路需要可追溯。
5. **临时产物不要进仓库**：`*.log`、`.tmp-*`、截图等用完即删（见 `AGENTS.md` 的提交约定）。
6. **配图统一放 `docs/assets/`**：截图、示意图、复核证据都进这个目录（如 `docs/assets/playwright/`），
   不要再在仓库根新增 `output/`、`screenshots/` 这类工具目录（`/output/`、`/.playwright-cli/` 已在 `.gitignore` 里）。
