# 代码审查发现

本文件记录对 Solution 项目的系统性代码审查结果。分两部分：**已修复**与**待处理**。

审查范围：`src/`（142 个 TS/TSX 文件）、`crawler/`（10 个 Python 文件）、`prisma/`、Docker 与部署配置。

---

## 一、已修复

### 1. 爬虫链路是半成品（最重要的功能缺口）

**发现**：

- `src/app/api/admin/crawler/run/route.ts` 只执行 Python 脚本并把 stdout 返回给前端，**抓到的文章从未写入数据库**。
- `src/app/api/admin/crawler/[id]/run/route.ts` 只插入一条 `status: "running"` 的日志，源码注释写着 `actual crawling would be triggered here`。
- `node-cron` 依赖和 `CRAWLER_INTERVAL_HOURS` 环境变量在 `package.json` / `.env` 中定义，但**全项目零引用**，定时爬取从未实现。
- `DEPLOY.md` 宣称"所有爬取的内容会进入审核队列，在后台审核通过后才会公开展示"，但代码中不存在审核队列。

**修复**：

- 新增 `src/lib/crawler-ingest.ts`：执行 Python → 按 `sourceUrl` 去重 → 以 `status: "draft"`（审核态）入库，挂在 `crawler@solution.local` 系统账号下 → 每个源与整体各写一条 `CrawlLog`。
- 新增 `src/lib/crawler-scheduler.ts` + `src/instrumentation.ts`：用 `node-cron` 按 `CRAWLER_INTERVAL_HOURS`（默认 24h）定时调用入库逻辑，仅生产环境注册。
  （后续为适配 Next 15 的 Edge instrumentation 编译，定时逻辑从 `instrumentation.ts` 拆到
  `crawler-scheduler.ts`，由 `NEXT_RUNTIME === "nodejs"` 分支内部动态引入，见
  [dependency-audit-2026-10.md](./dependency-audit-2026-10.md) 第三节第 6 项。）
- 两个 run 路由接入该逻辑；单源路由增加显示名 → CLI key 的映射（`Dev.to` → `devto`、`Stack Overflow Blog` → `stackoverflow_blog`）。
- 修复爬虫自身的两个启动级 bug（见下条）。

**验证**：实测 devto 源抓取 2 篇 → 入库为 draft → 二次运行正确跳过重复项。

### 2. 爬虫自身无法启动（两个 bug 叠加）

**发现**：

- `python crawler/main.py` 从项目根运行会 `ModuleNotFoundError: No module named 'crawler'`——脚本以文件方式执行时 `sys.path[0]` 是 `crawler/` 目录，找不到 `crawler` 包。`package.json` 的 `crawler:run` 脚本和 API 里的 `exec` 都踩中这一点。
- `crawler/sources/base.py` 使用 `httpx.Client(http2=True)`，但 `crawler/requirements.txt` 只写了 `httpx>=0.27.0`，未安装可选的 `h2` 包 → 每个源构造时即 `ImportError: Using http2=True, but the 'h2' package is not installed`，**7 个源全部失败**。

**修复**：

- 改为 `python -m crawler.main`（模块方式运行），同步更新 `package.json` 的 `crawler:run` 与 `crawler-ingest.ts` 的执行命令。
- `requirements.txt` 改为 `httpx[http2]>=0.27.0`；`base.py` 增加 `h2` 导入探测，缺失时优雅降级为 HTTP/1.1，避免单个依赖缺失拖垮全部源。

**验证**：修复前 0 篇，修复后成功抓取（日志显示 `HTTP/1.1 200 OK`）。

### 3. 投票计数不会回退（数据一致性 bug）

**发现**：`src/app/api/votes/route.ts` 中，新建投票会给 `question.voteCount` / `answer.voteCount` 增减，但**取消投票**（`existing.value === value` → 删除）与**翻转方向**（`+1` ↔ `-1`）只改 `Vote` 表，不回退冗余计数 → 计数永久虚高。

**修复**：三处分支统一用 `prisma.$transaction` 原子化——取消回退 `-existing.value`，翻转调整为 `value - existing.value`，新建 `+value`。文章（Article）无冗余计数字段，靠 `Vote` 表实时统计，不受影响。

### 4. `.env` 被纳入版本控制，密钥泄露

**发现**：`.gitignore` 虽已含 `.env` 规则，但 `.env` 在此规则加入前就被 `git add` 过，因此持续被跟踪；`AUTH_SECRET` 已存在于提交历史中。

**修复**：`git rm --cached .env`（保留本地文件）。**⚠️ 待你手动完成：轮换 `AUTH_SECRET`**（`openssl rand -base64 32` 重新生成），旧值应视为已泄露；如需清理历史可用 `git filter-repo`。

### 5. 管理端角色白名单不一致

**发现**：`src/app/api/admin/users/[id]/route.ts` 允许写入 `["USER", "ADMIN", "AUTHOR", "MODERATOR"]`，但系统实际只支持 `USER`/`ADMIN`，且 `src/app/api/users/route.ts` 只允许后两者 → 规则不一致，语义混乱。

**修复**：两处统一为 `z.enum(["USER", "ADMIN"])`。

### 6. `/api/tags` 创建接口无认证

**发现**：`POST /api/tags` 完全没有登录校验，匿名用户可直接创建标签，可被滥用刷脏数据。

**修复**：增加 `auth()` 登录校验（401）；同时让 slug 强制为纯 ASCII（见第 12 条）。

### 7. 爬虫源更新接口无字段校验

**发现**：`PUT /api/admin/crawler/[id]` 把请求体**整体**传给 `prisma.crawlSource.update`，无字段白名单。

**修复**：增加 zod schema（`name` / `url` / `category` / `enabled`），并返回具体校验错误。

### 8. 问答详情页 N+1 查询

**发现**：`(main)/questions/[slug]/page.tsx` 对**每个回答**单独发起 3 次投票查询（up/down/userVote），回答数为 N 时产生 3N 次数据库往返。

**修复**：改为一次 `groupBy`（up/down 各一次）+ 一次 `findMany`（当前用户投票）批量聚合，再在内存中组装。

### 9. 浏览计数与 ISR 缓存冲突

**发现**：`docs/[slug]`、`questions/[slug]` 声明了 `revalidate`，却在服务端渲染时执行 `viewCount: { increment: 1 }` 写库 → 页面每次访问都被强制动态渲染，缓存基本失效，且 SQLite 承受不必要的写竞争。

**修复**：新增 `src/app/api/views/route.ts` + `src/components/client/ViewTracker.tsx`，浏览数改由客户端挂载后异步打点，服务端渲染保持静态可缓存。

### 10. 上传的头像不持久化

**发现**：`/api/upload` 写入容器内 `/app/public/uploads`，而 `docker-compose.yml` 只挂载了 `/app/data` → 容器重建后头像全部丢失。

**修复**：新增 `uploads-data` 命名卷挂载到 `/app/public/uploads`。

### 11. 端口配置不一致

**发现**：`.env` / `.env.example` / `layout.tsx` / `robots.ts` / 详情页默认值使用 `localhost:3456`，而 `next dev` 脚本与 `docker-compose` 使用 `3000`。

**修复**：全部统一为 `3000`。

### 12. URL 中出现中文（会导致链接失效/报错）

**发现**：三处内容创建路由的 slug 生成正则 `/[^a-z0-9\u4e00-\u9fa5]+/g` **特意保留了中文**，中文标题会产生中文 URL（如 `/solutions/如何加速windows系统启动速度-xxx`，当时该路由为 `/docs`）；`/api/tags` 与内容创建时的 `connectOrCreate` 也会把中文标签名直接当 slug（`/tags/中文`）。这类 URL 在 nginx 配置、缓存、第三方分享等场景易失效。

**修复**：

- `src/lib/utils.ts` 新增 `generateSlug()`：无论中英文一律生成纯 ASCII 随机 id（类似 CSDN 的数字 id 风格），不携带任何标题文字。
- 新增 `src/lib/tags.ts`：`resolveTags()` 对中文标签按 `name` 查重（避免重复创建），slug 用随机 id；`parseTagInput()` 统一解析数组/JSON/逗号串。
- `prisma/schema.prisma` 新增 `SlugRedirect` 模型；`src/lib/slug-redirect.ts` 在详情页查不到内容时查表做永久重定向（`permanentRedirect`，308 与 301 同为永久重定向，搜索引擎等同处理），保留旧链接的 SEO 权重。
- 迁移脚本 `prisma/seed-redirects.ts` 记录历史中文 slug 映射。
- 已迁移数据库中 3 条中文 slug 记录。

### 13. 阻断构建的类型错误（8 处）

这些不是本次功能改动引入的，但会让 `next build` 失败，其中一处还是**真实运行时 bug**：

- **7 个文件使用默认导入** `import Link from "@/i18n/routing"`，而 `src/i18n/routing.ts` 只导出**具名**成员 → 运行时 `Link` 为 `undefined`，管理后台多个页面渲染即报错。涉及：`admin/content/page.tsx`、`admin/content/ContentActions.tsx`、`admin/content/[type]/[id]/edit/EditContentForm.tsx`、`admin/dashboard/page.tsx`、`admin/users/[id]/page.tsx`、`admin/users/UserRowActions.tsx`、`admin/comments/page.tsx`。
- `src/lib/tags.ts` 的 `bumpTagUsage(slugs, delta: 1 | -1)` 参数类型过窄，批量删除需要传 `-count` → 放宽为 `number`，并补上负数钳制以兑现其"不递减到负数"的注释承诺。
- `src/app/api/admin/content/bulk/route.ts` 传入 `targetLabel: null`，而类型是可选 `string` → 移除该行。

修复后 `npx tsc --noEmit` 从 5 个错误变为 **0 错误**。

### 14. 全面缺陷排查（2026-10-07，三路并行审计）

按「安全 → 数据一致性 → 前台可用性」分批修复，每条都有可复现证据（HTTP 实测或直连 Prisma 对比）。

**输入健壮性与安全**

| 问题 | 证据 | 修复 |
|---|---|---|
| **限流 key 由客户端 `X-Forwarded-For` 决定** | 轮换该头 6 次请求，第 6 次才 429；换头即重置额度 = 登录撞库/注册/评论/上传额度可无限绕过；不带头的请求共用 `unknown:*` 桶，一人可打满全站 | `getClientIp()` 仅在 `TRUST_PROXY=1` 时取**最后一跳**；否则退化为 `direct:<suffix>`；审计 IP 复用同一函数 |
| **非法 JSON → 500**（27 个 `route.ts`） | `POST /api/views` 传 `{not json` → 500 `记录失败` | 新增 `src/lib/request.ts` 的 `readJson()`，非法 JSON 一律 400；实测 4 个接口全部 400 |
| **`/api/votes`、`/api/bookmarks` 直接解构 body** | 传 `null`（合法 JSON）→ `TypeError: Cannot destructure property ... of 'null'` → 500；数字 `targetId` 直达 Prisma → 500 | 两处改 zod（白名单 + 长度 + 整数），非法一律 400 |
| **`/api/bookmarks` 无限流** | 脚本可无限写表 | 补 30/60s |
| **`/api/search` 无最小长度、无限流** | `?q=a` 即触发三张表 `contains` 全表扫描 | `q` ≥ 2 字符、截断 100、限流 60/60s |
| **`/api/rss` 字符串拼 XML** | 昵称 `A&B` 的用户发一篇文章，整个 feed 变成 non-well-formed；标题含 `]]>` 可击穿 CDATA 注入任意 XML | 新增 `escapeXml()` / `escapeCdata()` 并逐处套用 |

**数据一致性**

| 问题 | 证据 | 修复 |
|---|---|---|
| **删除内容不清理多态 `Vote`/`Bookmark`** | 老库里 4 条 Vote、1 条 Bookmark **100% 是孤儿**；`targetType="answer"` 在全部 5 条删除路径上都没有清理 | 新增 `purgePolymorphicRows()`（`src/lib/content-purge.ts`），前台三个 DELETE / 答案删除 / 后台内容删除 / 批量删除 / 删号全部接入 |
| **并发投票把 `voteCount` 打飞** | 两次并发切换后 `Question.voteCount = -3`，而真实和为 -1，无重算入口 | 投票分支改为交互式事务内读取 + `aggregate` 重算绝对值（自校正），并用 `upsert` 消除 P2002 |
| **后台删号在"自问自答"用户上必然 500** | `affectedQuestionIds` 含已被删除的问题 → `question.update` 抛 P2025 → 整个事务回滚 → 接口 500、用户删不掉 | 改为 `updateMany`（记录不存在时静默跳过） |
| **`resolveTags` 的 name/slug 不一致** | 管理员把标签改名为纯 ASCII 后，任何用户再提交该名 → `connectOrCreate` 建新记录 → `Tag.name` 唯一冲突 → 内容创建 500 | ASCII 分支先按 `name` 回查复用 |
| **唯一约束冲突一律 500** | 并发收藏第二次报 `P2002`；并发注册同理 | 收藏命中 P2002 时按"已收藏"返回；投票改 `upsert` |
| **`seed.ts` 在 name/slug 冲突时整脚本退出 1** | 库中已有同 `name` 不同 `slug` 的标签时 `upsert({where:{slug}})` 撞 `Tag.name` 唯一约束，管理员账号都不会创建 | 先按 `slug` 或 `name` 回查，命中即复用 |
| **`seed-redirects.ts` 用 raw SQL 写时间与 id** | `id` 截断到 24 字符会碰撞；`datetime('now')` 写入 TEXT，导致 `createdAt < now` 的过滤匹配 0 行 | 改走 Prisma `create`（cuid + 毫秒时间） |

**缓存与权限**

| 问题 | 证据 | 修复 |
|---|---|---|
| **创建/删除不失效 ISR** | 列表页与首页不读 cookie、确实走 ISR（60s/300s）：发布后新内容不出现、**删除后旧条目仍挂在列表上，点进去 404** | POST/DELETE 补 `revalidateContent` / `revalidateContentList`；答案与评论写操作失效所属详情页 |
| **前台写接口用 JWT 冻结的 `role` 做管理员旁路**（欠账 2） | 降权/封禁的管理员在 token 过期前（默认 30 天）仍可改删任何人的内容 | 5 个文件的判定统一换成 `getSessionUser()` + `isActiveAdmin()` |

**前台可用性**

| 问题 | 证据 | 修复 |
|---|---|---|
| **回答提交/采纳/收藏失败时完全静默** | 三个组件只有 `if (res.ok)`、`try/finally` 无 `catch`；服务端确定会返回 400（如回答短于 10 字符）、401、404、500 | 新增 `src/lib/http-error.ts` 的 `readErrorMessage()`；`AnswerForm` 补 `error` 状态与 `role="alert"` 提示，`AcceptButton`/`BookmarkButton` 用 sonner toast，个人中心 `fetch` 补 `.catch` |
| **没有 `not-found.tsx`** | 5 处 `notFound()` 全部落到 Next 内置英文 404，且渲染在本地化 layout 之外（无导航/页脚/返回入口） | 新增 `src/app/[locale]/not-found.tsx`（`errors.notFoundTitle/notFoundDescription` + 回首页按钮）。**注意：HTTP 状态码仍是 200**（见第二节） |
| **筛选 pill 丢掉 `tag` 参数** | 从标签页进来后点状态/分类筛选会被踢出标签范围，分页链接却保留 | 三个列表页的筛选链接改为拼上 `tag` |
| **11 个 `<label>` 缺 `htmlFor`** | 三个内联编辑表单点标签不聚焦、读屏报无标签控件 | 全部补齐：8 个普通控件走 `htmlFor`/`id`，3 个内容字段走 `<RichEditor labelledBy>`（映射 `aria-labelledby`） |
| **图标按钮缺 `aria-label`** | `AcceptButton` 与 `CommentSection` 的编辑/删除按钮只有 `title` | 已补；`CommentSection` 的 Markdown 工具栏按钮仍是 `title` + 文本内容，未逐个改 |
| **取消系统分享被当成"已复制"** | `navigator.share` 的 `AbortError` 被空 catch 吞掉后继续走剪贴板分支 | 区分 `AbortError` 直接 return |
| **三处用户可见文案绕过 i18n** | `RatingWidget` 的英文 `aria-label`、页脚的 `Made with … by Solution Team`、`solutions` 页的硬编码全角 `：` | 三个词条（`common.rateStars`/`common.madeWith`/`docs.problemLabel`），`i18n:check` 从 1075 → 1080 键 |

### 15. 图片/视频/附件上传（2026-10-07，功能 + 验证中发现并修掉的三个问题）

功能本身：`/api/upload` 从"只收 4 种图片、2MB、全部塞进 `avatars/`"扩展成六类矩阵（图片/视频/音频/PDF/压缩包/文档），
新增 `Attachment` 模型与 `/api/attachments` 列表/删除接口，编辑器新增视频节点、附件节点与三个上传按钮。
细节见 [security.md](./security.md)「上传类型矩阵」与 [frontend.md](./frontend.md)「图片、视频与附件上传」。

验证过程中暴露的三个真实缺陷（都已修，且都有可复现证据）：

| 问题 | 现象与证据 | 修复 |
|---|---|---|
| **客户端包被拖进 Node 模块** | 编辑器 import `@/lib/upload` 后，`next dev` 直接报 `Build Error: Module not found: Can't resolve 'fs/promises'` —— 该模块含 `fs/promises`/`crypto`/`path` | 拆成 `src/lib/upload-shared.ts`（纯策略、嗅探、校验，浏览器可用）与 `src/lib/upload.ts`（落盘/删除，服务端专用），客户端只 import 前者；约束写进 AGENTS.md §2.8 |
| **连续插入会互相覆盖** | 浏览器实测「附件 → 图片 → 视频」后，正文里只剩附件与视频，图片消失（`has img: false`）。根因：插入 atom 节点后它保持 NodeSelection，下一次 `insertContent` 把它**替换**掉 | 每次插入后 `editor.commands.focus("end")`，把光标移到文末；e2e 现在断言三种节点同时存在 |
| **只有附件没有正文时无法发布** | 正文为「附件 + 视频 + 一句话」时提交被前端拦下（正文不足 20 字），因为 `plainTextLength()` 把生成标记的内容全当标签剥掉了 | 与公式同一处理：把 `data-filename` 与 `img[alt]` 计入可读文本长度 |

验证手段（可重跑）：

- `npx tsx scripts/_tmp-upload-verify.mjs unit` —— 27 条断言：14 种格式的魔数嗅探、HTML/SVG/空文件被拒、
  「ZIP 声明成 PNG」「HTML 声明成 PDF」被拒、`image/svg+xml` 直接 400、超限判定、头像只允许图片且 2MB、
  文件名穿越与 `uploadUrlToPath` 越界防护。
- `… http` —— 未登录 401；图片/PDF/压缩包/视频/文档 201；伪装内容 400；SVG 400；9MB 图片 413；
  PDF 当头像 400；上传后可访问、列表可见、删除后磁盘文件消失，跑完自清理。
- `scripts/_tmp-media-e2e.mjs`（Playwright 真浏览器，登录改用 API 注入 cookie）—— 10 条断言：
  三个入口分别上传并插入，编辑器 DOM 三种节点同时存在，发布后详情页渲染附件卡片（文件名 + `PDF 文档 · 2 KB`）、
  图片、视频，卡片 `href` 指向上传且带 `download`。

---

## 二、待处理
按影响面排序，均未修改。

| 优先级 | 问题 | 位置 / 说明 |
|---|---|---|
| 高 | **轮换 `AUTH_SECRET`** | 旧值已进入 git 历史（见第 4 条），需手动生成新值 |
| 高 | **API 风格不统一** | 少量路由用 `apiHandler` 包装（错误格式 `{success:false,error}`），多数手写 try/catch（`{error}`）；前端两套格式混着解析（`d.success !== false ? d.data : d`），易踩坑 |
| 中 | **i18n 覆盖不完整** | `messages/zh.json`、`en.json` 只有少量 key，文章详情、问答、管理后台等大量页面硬编码中文，切换英文后仍显示中文 |
| 中 | **无任何测试** | 无 jest/vitest 配置、无测试目录；`npm run lint` 存在但无 CI |
| 中 | **CSP 较弱** | `next.config.mjs` 中 `script-src` 含 `'unsafe-inline' 'unsafe-eval' https:`，防护强度有限（Next.js 动态渲染通常需要放宽，可接受但应知悉） |
| 中 | **默认管理员密码硬编码** | `prisma/seed.ts` 中 `admin@solution.local / admin123`，生产部署必须修改 |
| 低 | **`og-image.png` 不存在** | `layout.tsx` 与 `(main)/layout.tsx` 的 metadata 引用 `/og-image.png`，但 `public/` 下没有该文件 → 社交分享图为 404 |
| 低 | **爬虫合规风险** | 知乎/CSDN 等站点未处理 robots.txt 与站点条款，仅靠随机 UA + 请求延迟缓解，生产环境有法律与 IP 封禁风险 |
| 低 | **`marked` 类型不匹配** | `marked` v18 同时用于服务端与客户端，`@types/marked` 在 devDependencies 中，代码用 `as string` 绕过 |
| 低 | **`braces` 传递依赖无上游补丁** | 仅存在于构建/lint 工具链，不在生产产物中；理由与监控条件见 [dependency-audit-2026-10.md](./dependency-audit-2026-10.md) 第四节 |

### 2.1 2026-10-07 排查后仍未处理的项

| 优先级 | 问题 | 说明 / 建议 |
|---|---|---|
| 中 | **未知 slug 返回 HTTP 200（软 404）** | 详情页因 `auth()` 而动态渲染，`solutions/[slug]`、`questions/[slug]` 等段落都有 `loading.tsx`，Shell 先刷出、`notFound()` 后置 → 状态码已提交为 200。页面内容已本地化（见 1.14），但 SEO 与监控拿不到 404。可选方案：把存在性检查移到 `generateMetadata`，或对该段落去掉 `loading.tsx`，或在 middleware 里先做一次存在性校验。已验证：`/solutions/<unknown>` 与 `/en/...` 都是 200 + 自定义 404 页面 |
| 中 | **站内跳转仍用 `next/link`** | 约 20 个页面/组件（Navbar、Footer、三个列表页、详情页、登录注册、通知、个人中心）用 `next/link` / `next/navigation` 的 `useRouter`。因 `NEXT_LOCALE` cookie 存在，next-intl 中间件会 307 回 `/en/*`，**没有复现"掉回中文"**，代价是每次站内点击多一跳 307。修法：把 `import Link from "next/link"` 换成 `import { Link } from "@/i18n/routing"`，`useRouter` 同理（只调 `refresh()` 的可保留） |
| 低 | **`toLocaleTimeString()`/`toLocaleString()` 未传 locale** | `questions/ask`、`software/new`、`solutions/new` 的草稿"已保存于"时间与首页的 `s.value.toLocaleString()` 按运行环境默认语言输出，与 `formatDate(date, locale)` 的约定不一致 |
| 低 | **`GET /api/comments` 仍是每次返回整条线程** | 已加 500 条硬上限与 `truncated` 标记（`AGENTS.md §2.4` 的分页约定未套用），嵌套结构决定了真正的分页需要游标 + 客户端改树 |
| 低 | **限流在直连部署下退化为全局桶** | 见 [security.md](./security.md) 第四节：无 `TRUST_PROXY` 时同一 suffix 共享额度，一个客户端可打满注册/评论额度 |

---

## 三、验证状态说明

- `npx tsc --noEmit` → **exit 0（无类型错误）**
- 运行时验证：`/logo.svg`、`/icon.svg` 返回 200；首页/登录/注册页正常渲染
- 爬虫入库链路：真实抓取 → 入库 draft → 去重，均已实测
- **完整 `next build` 已通过**（2026-10，Next 15.5.27 + React 19）：`Compiled successfully`，
  31/31 静态页 + 全部路由 + middleware。更完整的依赖审计与运行时冒烟测试见
  [dependency-audit-2026-10.md](./dependency-audit-2026-10.md) 第六节。

---

## 四、依赖安全审计

npm 依赖层面的漏洞修复单独记录在 [dependency-audit-2026-10.md](./dependency-audit-2026-10.md)：
审计项 97 → 7，critical / moderate 全部清零；剩余 7 项同一根因 `braces`，上游无补丁版本且仅存在于
构建与 lint 工具链（不在生产产物中），已按「已接受风险」处理并写明监控条件。
