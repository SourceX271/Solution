# Solution 网站全面审计与修复报告

审计时间：2026-09-30 · 范围：Next.js 14 (App Router) + Prisma/SQLite + next-auth v5 + next-intl + Python 爬虫 + Docker 部署
验证状态：`tsc --noEmit` ✅ · `next lint` ✅ · `next build` ✅ (exit 0) · 生产服务器 HTTP 冒烟测试 ✅

---

## 1. 必须先处理的人工事项（我无法代做）

1. **轮换密钥（最高优先级）**：`.env` 此前被 git 跟踪，`AUTH_SECRET` 与 `AUTH_GITHUB_SECRET` 已进入仓库历史。
   任何人都能用 `AUTH_SECRET` 伪造任意用户（含管理员）的 JWT。
   我已执行 `git rm --cached .env`（本地文件保留），并把 `.env*` 加入 `.dockerignore`；但**必须**：
   - 重新生成 `AUTH_SECRET`（`openssl rand -base64 32`）
   - 在 GitHub 重新生成 OAuth Client Secret
   - 清理 git 历史（`git filter-repo` / BFG），否则旧密钥永久可读
2. **种子管理员密码**：默认 `admin123`。现可用 `SEED_ADMIN_PASSWORD` 覆盖，seed 也打印警告；生产环境务必设置并首次登录后修改。
3. **Docker 构建未实测**：本机 Docker daemon 未运行，Dockerfile/compose 的修改仅经过静态推演与 `next build` 验证，请在具备 Docker 的机器上跑一次 `docker compose up -d --build`。

---

## 2. 已修复问题（按严重程度）

### 严重（安全）

| # | 问题 | 位置 | 修复 | 验证 |
|---|------|------|------|------|
| 1 | **`/en/admin/*` 完全无鉴权**：中间件用 `pathname.startsWith("/admin")` 判断，而英文站点是 `/en/admin/...`，判断永远为假；`admin/layout.tsx` 也没有任何鉴权 → 匿名可读全部用户邮箱/角色、草稿、爬虫源与站点设置，`/en/admin/settings` 甚至触发写入 | `src/middleware.ts`、`src/app/[locale]/admin/layout.tsx` | 中间件先剥离 locale 前缀再匹配路由；admin layout 增加服务端二次校验（并从数据库重读角色，而非信任 JWT） | HTTP：`/en/admin/users` → **307 → /en/login**（修复前 200） |
| 2 | **命令注入**：`exec(\`python -m crawler.main --source ${source}\`)`，`source` 来自查询参数 | `src/lib/crawler-ingest.ts` | 改用 `execFile` + 参数数组，并对照 `crawler/main.py` 的 `SOURCES` 做白名单校验 | tsc/build |
| 3 | **存储型 XSS（答案）**：答案 HTML 未经任何过滤直接 `dangerouslySetInnerHTML`，而 API 接收任意 HTML | `AnswerItem.tsx`、`api/questions/[id]/answers`、`api/answers/[id]` | 渲染端 DOMPurify 白名单；写入端用 `sanitizeHtml` 落库 | tsc/build |
| 4 | **JSON-LD `</script>` 逃逸**：`JSON.stringify` 不转义 `<`，标题含 `</script><script>…` 即可注入 | `src/components/JsonLd.tsx` | 序列化时转义 `<`/`>`/`&` 为 `\u003c` 等 | tsc/build |
| 5 | **开放重定向**：`/login?callbackUrl=https://evil.com` 登录后 `router.push` 跳外站 | `login/page.tsx` | 仅允许以 `/` 开头且非 `//`、`/\` 的相对路径 | tsc/build |
| 6 | **`.env` 被提交进仓库** + `.dockerignore` 未排除 `.env` → 密钥进入镜像层 | 仓库根 | `git rm --cached .env`；`.dockerignore` 增加 `.env`/`.env.*`（保留 `.env.example`） | `git ls-files` 已不含 `.env` |
| 7 | 上传接口：MIME 白名单含 SVG，且仅信任客户端声明的 Content-Type | `api/upload/route.ts` | 移除 SVG；新增**魔数校验**（JPEG/PNG/GIF/WebP），扩展名由真实类型决定 | tsc/build |
| 8 | 生产 CSP 含 `'unsafe-eval'` | `next.config.mjs` | 仅开发模式保留 `unsafe-eval` | build |
| 9 | 登录无频率限制（可无限爆破）；改密接口同样无限制 | `lib/auth.ts`、`api/users/me/password` | 登录按 IP+邮箱限流（10 次/10 分钟）；改密 5 次/15 分钟，并禁止新旧密码相同 | tsc/build |
| 10 | 投票/收藏不校验 `targetType` 与目标是否存在 → 可写入垃圾数据、投票不存在目标返回 500 | `api/votes`、`api/bookmarks` | 类型白名单 + 目标存在性校验（404） | tsc/build |
| 11 | 管理员可自我降权 / 降掉最后一个管理员 → 永久锁死后台；被降权者的 JWT 仍带 ADMIN 角色 | `api/admin/users/[id]`、`admin/layout.tsx` | 角色从数据库重读；禁止自我降权；保留至少一名管理员 | tsc/build |
| 12 | 角色下拉提供 `AUTHOR`/`MODERATOR`，但 API 只接受 `USER`/`ADMIN` → 2/4 选项静默失败 | `admin/users/UserActions.tsx` | 选项与 zod enum 对齐，加二次确认与成功/失败提示 | tsc/build |

### 高（数据丢失 / 功能不可用）

| # | 问题 | 位置 | 修复 |
|---|------|------|------|
| 13 | **「遇到的问题」字段被静默丢弃**：`articleSchema` 无 `problem`，zod 直接剥离；两个详情页却会渲染它 | `lib/validations.ts`、`api/articles`、`api/articles/[id]` | schema 增加 `problem`，创建/更新均落库；表单改为始终发送（可清空） |
| 14 | **后台编辑表单被自家 API 400 拒绝**：表单发送 `null` 清空 excerpt/url/image，zod `.optional()` 不接受 `null` → 保存静默失败 | `api/admin/content/[type]/[id]`、`EditContentForm.tsx` | 相关字段改 `.nullable().optional()`；补 `tags` 关系写入；表单标签预填修正（原为 `[object Object]`）、增加 toast 反馈 |
| 15 | **分页参数 NaN → 500**：`?page=abc` 使 `skip` 为 NaN，Prisma 抛错 | `lib/errors.ts` 及 articles/questions/software/users 路由、2 个后台页 | 新增 `toPositiveInt`，安全解析并限幅 | 运行时：`/api/articles?page=abc` → **200**（修复前 500） |
| 16 | `?type=xxx` 直接使后台内容页 500（`typeLabels[type].icon` 为 undefined） | `admin/content/page.tsx` | 校验并回退到 `articles` |
| 17 | **通知系统整体失效**：Notification 表、通知页、铃铛都存在，但代码中**从未创建过任何通知** | 新增 `lib/notifications.ts` | 评论→内容作者、回答→提问者、采纳→答主；自己操作自己不发通知 |
| 18 | 通知页「全部已读」是原生表单 POST 到 JSON API → 浏览器直接显示裸 JSON，页面丢失 | `notifications/page.tsx` + 新增 `MarkAllReadButton.tsx` | 改为客户端组件调用 JSON 接口并刷新 |
| 19 | 通知铃铛点击不跳转（`n.link` 从未使用）；`fetch` 无 catch；「全部已读」逐条 PATCH | `NotificationBell.tsx` | 点击跳转到 `link`；统一走 mark-all；错误处理；Esc 关闭；aria-expanded |
| 20 | 软件详情页收藏按钮硬编码 `isBookmarked={false}` → 已收藏时点击会**取消**收藏但 UI 显示相反 | `software/[slug]/page.tsx` | 与文章/问答页一致地查询真实收藏状态 |
| 21 | 软件简介是富文本 HTML，却按纯文本渲染 → 页面出现 `<p>` `<strong>` 字面量 | `software/[slug]`、`software/page.tsx` | 详情页经 `sanitizeHtml` 渲染；列表卡片与 meta/JSON-LD 去标签 |
| 22 | **Markdown 内容按原样输出**：种子/爬取内容是 Markdown，详情页却当 HTML 渲染 → 页面直接显示 `## 标题` | `docs/[slug]`、`questions/[slug]` + 新增 `lib/render.ts` | 自动判别 HTML/Markdown，Markdown 走 `marked` 再高亮、净化 | 运行时验证：`## 问题描述` → `<h2 id="问题描述">`，代码块 hljs 高亮 |
| 23 | 重复标题生成重复锚点 id → TOC key 冲突、点击总是跳到第一个 | `docs/[slug]/page.tsx` | `headingId()` 按出现顺序去重（`问题描述`、`问题描述-1`） | 运行时验证 ✅ |
| 24 | 采纳答案后问题状态从不更新 → 「已解决」徽标与筛选永远为空 | `api/answers/[id]` | 采纳 → `status="solved"`；删除被采纳答案 → 回退 `open`；`answerCount` 事务化且不为负 |
| 25 | `Tag.usageCount` 从不更新 → 所有标签恒为 0，「热门标签」排序无意义 | `lib/tags.ts` + 各创建/删除路由 + 爬虫入库 | 新增 `bumpTagUsage()`，创建 +1、删除 -1（带非负保护） |
| 26 | 删除内容不清理多态 Vote/Bookmark → 孤儿数据、个人页出现死链 | `api/admin/content/[type]/[id]` 等 | 删除时同步清理 |
| 27 | 软件评分：先聚合再写回，非事务，并发下评分漂移 | `api/votes` | 评分写入 + 聚合同一事务 |
| 28 | 评论可回复到「别的目标」下的评论；目标不存在时返回 500；无通知；失败无反馈；删除无确认 | `api/comments`、`CommentSection.tsx` | 目标存在性校验 + 同目标校验 + 通知 + 错误提示 + 删除确认 |
| 29 | Cron 表达式 `0 */N * * *` 当 N>23 时非法 → 进程启动即抛错 | `src/instrumentation.ts` | 限制 1–23 |
| 30 | `/api/rss` 被静态预渲染 → 部署后永远输出构建时刻的旧数据 | `api/rss/route.ts` | `force-dynamic` + 1h 缓存头 | 运行时：返回当前 6 条 ✅ |
| 31 | `sitemap.ts` 静态生成导致 `next build` 需要可用数据库（Docker 构建失败） | `src/app/sitemap.ts` | `force-dynamic` | build ✅ |
| 32 | 首页：hero 标题重复渲染副标题、`heroTitle` 从未使用；筛选项链接丢失 locale 前缀；「查看更多」始终跳解决方案；统计数字串行查询；无效 CSS 变量 | `(main)/page.tsx` | 标题用 `heroTitle`；链接带 locale；按当前筛选跳转；并入 `Promise.all`；移除无效样式 | 运行时：`/en?type=article`、`/en/docs` ✅ |
| 33 | `loading.tsx` 用 `Math.random()` 生成骨架宽度 → 服务端/客户端不一致（hydration mismatch） | `(main)/loading.tsx` | 改为固定宽度数组 |
| 34 | 后台设置页 GET 会 `create` 行，并发首访 P2002 → 500 | `admin/settings/page.tsx` | 改 `upsert` |
| 35 | 后台列表「查看」按钮全部 404：文章指向不存在的 `/articles/<id>`，问答/软件用 id 而路由用 slug | `ContentActions.tsx`、`admin/content/page.tsx` | 用 slug + 正确前缀 `/docs`、新窗口打开 |
| 36 | 爬虫：全部源失败仍上报 `success`；4xx 也重试 3 次；异常时不关闭 httpx 连接；爬取分类被丢弃；`--source` 名称映射失败时静默改为全量爬取 | `crawler/main.py`、`sources/base.py`、`crawler-ingest.ts`、`api/admin/crawler/**` | 状态按成功源数计算；4xx 快速失败；`finally` 关闭；分类映射表；未知源返回 400 |
| 37 | 种子脚本：每次重跑都会插入重复答案，且 `answerCount` 恒为 0（前端显示「0 回答」） | `prisma/seed.ts` | 幂等写入 + 重算计数 |
| 38 | Docker：`/app/data` 不存在且 volume 归属 root → 首次启动数据库不可写；`public/` root 属主导致头像上传 EACCES；Alpine python 与 `/usr/local` 依赖路径不匹配 → 爬虫 `ModuleNotFoundError`；standalone 镜像无 Prisma CLI，DEPLOY.md 的初始化命令无法执行 | `Dockerfile`、`docker-entrypoint.sh`（新增）、`docker-compose.yml`、`DEPLOY.md`、`.dockerignore` | 构建期 `db push` 生成 schema 快照 → 启动脚本按需复制到数据卷；创建并 chown 可写目录；`PYTHONPATH` 指向 `/usr/local/...`；`PYTHON_BIN` 默认按平台选择；`npm ci` 前先拷贝 schema（`postinstall` 需要） |
| 39 | 前端一致性/可访问性：投票按钮仅靠颜色表达状态且无可访问名称、失败无提示；通知未读仅靠颜色；`<html lang>` 恒为 `zh`；OG locale 固定 | `VoteButtons.tsx`、`admin/layout.tsx`、新增 `HtmlLang.tsx`、`[locale]/layout.tsx` | `aria-pressed`/`aria-label`/`title` + 错误提示；按 locale 同步 `lang`；按 locale 设置 OG locale/alternate |
| 40 | 密码规则三处不一致：注册页要求 6 位、后台设置 6 位、服务端 8 位+字母数字 | `register/page.tsx`、`SettingsForm.tsx`、`messages/*.json` | 全部对齐为 8 位且含字母与数字 |

---

## 3. 尚未修复（建议排期）

| 优先级 | 事项 | 说明 |
|---|---|---|
| 高 | **英文站点实际仍是中文** | `messages/en.json` 存在且有 194 个键，但约 30 个页面/组件直接硬编码中文（含 `<title>`/description、日期格式 `formatDate`/`formatRelativeTime` 全部默认 `zh`）。这是产品级缺口，需按页改造，非单点 bug。 |
| 高 | **GitHub OAuth 用户没有数据库记录** | 未接 Prisma adapter，也没有在 `signIn`/`jwt` 中 upsert 用户：OAuth 登录后 `session.user.id` 是 GitHub 的 id，写评论/回答/收藏会因外键失败，个人资料页为空。修复需引入 `@auth/prisma-adapter`，或在**校验邮箱归属**后再做账号关联（当前注册不验证邮箱，直接按邮箱合并会造成账号接管风险）。属于设计决策，未擅自实现。 |
| 中 | 没有 Prisma migrations | `prisma/` 下无 `migrations/`，只能 `db push`，缺少可复现的升级路径与回滚。 |
| 中 | 后台缺 `loading.tsx`/`error.tsx`；破坏性操作提示不完整 | 已补主要操作的 toast，但错误边界/骨架屏仍缺。 |
| 中 | 剩余可访问性 | 多个表单 `<label>` 缺 `htmlFor`/`id`、发布页不是 `<form>`（回车不提交）、搜索框无可访问名称。 |
| 中 | 23 个页面仍用 `next/link` 而非 `@/i18n/routing` 的 Link | 在 `/en` 下点击会整页跳转并依赖 cookie 重定向；首页已修，其余未动。 |
| 中 | 「添加数据源」是装饰性的 | Python 侧 `SOURCES` 硬编码，`CrawlSource.enabled` 不参与 cron 调度；新增源除名称命中别名外无法运行。 |
| 低 | 其它 | 后台列表未把 `page` 限制到 `totalPages`；`Article.viewCount + 1` 的显示（ISR 页面必然滞后）；`seed-redirects.ts` 用 TEXT 存 `datetime('now')` 且 id 截断可能碰撞；`@unique` 列上重复索引；`lib/sanitize.ts` 仍允许 `style` 属性；内存版限流在多实例下不共享；`CodeBlock.tsx` 剪贴板无 catch（当前未被使用）。 |

---

## 4. 验证记录

```
npx tsc --noEmit        → 无错误
npx next lint           → ✔ No ESLint warnings or errors
npm run build           → ✓ Compiled successfully / ✓ Generating static pages (27/27) / exit 0
python -m py_compile    → exit 0（crawler/main.py, crawler/sources/base.py）

生产服务器（next start）HTTP 冒烟：
  /                      200
  /en                    200
  /en/admin/users        307 → /en/login      ← 修复前为 200（越权可读）
  /admin                 307 → /login
  /en/admin/settings     307 → /en/login
  /api/notifications     401
  /api/admin/stats       403
  /api/rss               200（动态，6 条）
  /sitemap.xml           200
  /api/articles?page=abc 200                  ← 修复前 500
  /en/software           200

Markdown 渲染回归（临时插入文章后验证并清理）：
  输入 "## 问题描述" → 输出 <h2 id="问题描述">问题描述</h2>
  重复标题 → id 去重为 "问题描述" / "问题描述-1"
  代码块 → <pre><code class="hljs language-js">…</code></pre>
```

改动规模：68 个文件修改，新增 5 个文件（`lib/notifications.ts`、`lib/render.ts`、`components/HtmlLang.tsx`、`notifications/MarkAllReadButton.tsx`、`docker-entrypoint.sh`）、1 个配置文件（`.gitattributes`）。
