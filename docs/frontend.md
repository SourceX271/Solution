# 前端：路由、页面与组件

Next.js 15 App Router。locale 路由为 `zh`（默认，**无前缀**）/ `en`（`/en` 前缀），路由组 `(main)`、`(auth)` 不进 URL。
所有 `params` / `searchParams` 都是 **Promise**（Next 15 起），页面内 `await` 后使用。

---

## 一、路由骨架

```
src/app/
├── layout.tsx               根布局：<html lang="zh">（中文默认元数据、metadataBase、OG/Twitter 兜底）
├── icon.svg                 图标（文件约定注入 <link rel="icon">）
├── robots.ts  sitemap.ts    /robots.txt、/sitemap.xml
├── api-docs/page.tsx        /api-docs（不在 locale 下、硬编码中文、内容已过期）
├── api/                     见 api-reference.md
└── [locale]/
    ├── layout.tsx           校验 locale → NextIntlClientProvider → HtmlLang → ThemeProvider
    │                        → SessionProvider → Navbar → main → FooterClient → BackToTop → Toaster(sonner)
    │                        generateMetadata：按 locale 覆盖站点名/描述/关键词/OG
    ├── (main)/              公开页面（无自己的 layout，与 (auth) 共用上面这层）
    ├── (auth)/              login、register
    └── admin/               后台（自带 layout：回库鉴权 + noindex + force-dynamic）
```

> `(main)` 与 `(auth)` **都没有独立 layout**，因此登录/注册页也会渲染 Navbar 与 Footer。
> `FooterClient` 在路径含 `/admin` 时返回 `null`，后台不显示页脚。

---

## 二、页面清单

「模式」列：`ISR N` = `export const revalidate = N`；`FD` = `export const dynamic = "force-dynamic"`；`—` = 未声明。

### 公开页面（`(main)`）

| URL | 用途 | 数据源 | 分页 / 条数 | 模式 | 鉴权 |
|---|---|---|---|---|---|
| `/`、`/en` | 首页：Hero + 搜索 + 4 项统计 + 三类内容混合流 + 热门标签 | `article`/`question`/`software` `findMany`（各 8 条）+ `tag`（20）+ 4 个 `count` + `siteConfig` | 每类 8；标签展示 15 | ISR 300 | 公开 |
| `/solutions` | 解决方案列表：分类侧栏 + 卡片网格 | `article`（published，可按 category/tag 过滤）+ `count` + `tag` | 12/页，`?page&category&tag` | ISR 60 | 公开 |
| `/solutions/[slug]` | 详情：TOC、相关方案、正文（Markdown→HTML→高亮→净化）、投票/收藏/分享、评论 | `article` + 投票计数 + 用户投票 + 收藏 + 相关（同标签按浏览量 5 条） | 相关 5 | ISR 3600 | 阅读公开；编辑按钮仅作者/ADMIN |
| `/solutions/new` | 发布方案（客户端表单：草稿自动保存/恢复、字数统计、字段级校验、Ctrl/⌘+Enter 提交） | `POST /api/articles` | — | — | middleware 保护 |
| `/questions` | 问答列表：状态 pill（全部/open/solved） | `question` + `count` + `tag` | 15/页，`?page&status&tag` | ISR 60 | 公开 |
| `/questions/[slug]` | 问题详情 + 回答列表 + 答题框 + 相关问答 | `question` + `answer` + `vote.groupBy`（已避免 N+1）+ 收藏 + 相关（按票数 5 条） | 回答不分页；相关 5 | ISR 1800 | 阅读公开；编辑仅作者/ADMIN；采纳由提问者 |
| `/questions/ask` | 提问（同发布方案：草稿自动保存、正文计数、字段级校验、"发布须知"侧栏） | `POST /api/questions` | — | — | middleware 保护 |
| `/software` | 软件推荐：6 个分类 pill + 评分卡片 | `software`（published，按 `rating desc, createdAt desc`）+ `count` + `tag` | 12/页，`?page&category&tag` | ISR 60 | 公开 |
| `/software/[slug]` | 软件详情：星级评分、富文本介绍、信息侧栏、相关软件、评论 | `software` + 用户评分 + 收藏 + 相关（同分类按评分 5 条） | 相关 5 | ISR 3600 | 阅读公开；编辑仅作者/ADMIN |
| `/software/new` | 提交软件（同发布方案：官网链接校验、简介计数、字段级校验） | `POST /api/software` | — | — | middleware 保护 |
| `/tags/[slug]` | 标签聚合：三类内容各一段预览 + 相关标签（按共现） | `tag` + 三类 `findMany` + `count`（各取 100 个 id 算共现） | 每类 12；相关 10 | ISR 300 | 公开 |
| `/search` | 全局搜索（文章/问答/软件三段） | 三类 `contains` 查询 | 每类 10，无分页 | ISR 60（实际按请求渲染） | 公开 |
| `/profile` | 个人主页：资料、4 项统计、收藏、最近动态 | `GET /api/users/profile` | 接口返回（收藏 20、动态 10） | —（客户端） | middleware 保护 |
| `/settings` | 账户设置（`SettingsForm`：昵称/头像/简介/改密） | `auth()` + `user.findUnique`；写 `PUT /api/users/me`、`/api/users/me/password`、`POST /api/upload` | — | —（因 `auth()` 实际动态） | 页面内 `redirect("/login")` + middleware |
| `/notifications` | 通知中心：类型图标、未读数、全部已读 | `auth()` + `notification.findMany` | 50 条，无分页 | FD | 页面内 `redirect("/login")` + middleware |
| `/about`、`/privacy`、`/contact`、`/help` | 静态信息页（`/contact` 读站点配置邮箱） | `siteConfig`（仅 contact） | — | — | 公开 |

> 三个发布页的界面截图：[assets/publish-question.png](./assets/publish-question.png)（提问）、
> [assets/publish-solution.png](./assets/publish-solution.png)（发布方案）。

### 认证页面（`(auth)`）

| URL | 说明 |
|---|---|
| `/login`、`/en/login` | GitHub OAuth + 邮箱密码；`callbackUrl` 只接受站内相对路径（防开放重定向）；已登录访问会被 middleware 送回首页 |
| `/register`、`/en/register` | 前端校验与 `getRegisterSchema` 对齐（≥8 位、含字母与数字、两次一致），注册后自动登录 |

### 管理后台（`admin/`，全部 FD、全部继承 layout 鉴权）

| URL | 用途 | 分页 / 条数 |
|---|---|---|
| `/admin` | 重定向到 `/admin/dashboard`（带 locale） | — |
| `/admin/dashboard` | 6 张统计卡（含 30 天环比）、14 天活动图、待办队列、最新用户、最近审计、快捷入口 | 列表 4/5/8 条 |
| `/admin/content` | 内容管理：类型页签 + 状态筛选（带计数）+ 排序 + 搜索 + 表格 + 批量操作 | 10/页 |
| `/admin/content/[type]/[id]/edit` | 内容编辑（标题/正文/摘要/分类/状态/标签） | — |
| `/admin/comments` | 评论审核：3 个指标 + 表格 + 删除（提示回复会保留） | 20/页 |
| `/admin/users` | 用户管理：角色/状态筛选、内容数、最近登录、角色下拉、封禁/删除 | 15/页 |
| `/admin/users/[id]` | 用户详情：8 项统计、最近内容、最近评论、相关审计 | 各 5 / 8 条 |
| `/admin/tags` | 标签管理：计数漂移检测、编辑、合并、删除、重算 | 20/页 |
| `/admin/crawler` | 采集管理：源表格（启停/运行/删除）、一键全量、日志筛选与分页 | 日志 20/页 |
| `/admin/audit` | 审计日志：动作筛选 + 搜索 + 分页 | 25/页 |
| `/admin/settings` | 站点设置：名称/描述/SEO/社交/ICP/精选/三个开关 | 下拉候选各 50 |

---

## 三、middleware 守卫矩阵

`src/middleware.ts` = `auth()`（next-auth）包裹 `createMiddleware(routing)`（next-intl），顺序与规则：

1. 放行 `/api/**`、`/_next/**`、任何带扩展名的路径。
2. 先跑 i18n 中间件；若它产生重定向（带 `location`）立即返回。
3. 用 `/^\/(zh|en)(?=\/|$)/` 剥掉 locale 前缀得到「无前缀路径」——这一步是为修复当年 `/en/admin/*` 绕过守卫的漏洞。
4. 守卫规则：

| 匹配 | 未登录 | 已登录非管理员 |
|---|---|---|
| `/admin`、`/admin/**` | 307 → `{base}/login` | 307 → `{base}/` |
| `/profile`、`/settings`、`/notifications`、`/questions/ask`、`/solutions/new`、`/software/new` | 307 → `{base}/login` | 放行 |
| `/login`、`/register` | 放行 | 307 → `{base}/` |

> middleware 的 admin 判定读 **JWT 里的 `role`**（登录时冻结）；真正的兜底是 `admin/layout.tsx` 与
> `requireAdminApi()` 的**回库重读**。三层关系见 [security.md](./security.md)。

---

## 四、组件清单（48 个）

### `components/ui/`（16，Radix 封装原语）

`button`（cva + `asChild`）、`badge`、`card`、`input`、`textarea`、`label`、`select`、`dialog`、
`dropdown-menu`、`switch`、`tabs`、`toast`、`avatar`、`separator`、`skeleton`、`table`。

> `tabs.tsx` 与 `toast.tsx` **全站无引用**（实际用的是 sonner 的 `<Toaster>`），属死代码。

### `components/client/`（22，全部 `"use client"`）

| 组件 | 作用 | 主要接口 |
|---|---|---|
| `EditorToolbar` | 编辑器工具栏：按 `role="group"` 分组的文字样式 / 段落与列表 / 插入 / 历史，段落格式下拉（正文·H1–H3），右侧固定「视图」开关（富文本 / Markdown / HTML / 分屏）；每个按钮带 `title`（含快捷键）与 `aria-label`，开关类带 `aria-pressed` | 由 `RichEditor` 传入 `editor` 与回调 |
| `PublishShell` | 三个发布页共用的外壳：返回链接、标题与说明、页面级错误汇总、`Field`（label + 提示 + 计数器 + 字段错误，并用 `cloneElement` 把 `id`/`aria-*` 接到控件上）、草稿恢复横幅、`TipsCard`、粘性提交栏、Ctrl/⌘+Enter 提交 | — |
| `RichEditor` | Tiptap 3 富文本编辑器（所见即所得 / Markdown·HTML 源码 / 分屏预览，工具栏见 `EditorToolbar`）；**支持 LaTeX 公式**（`$…$`、`$$…$$`、`\(…\)`、`\[…\]`，输入与粘贴都会转成公式节点，双击可编辑）；同文件另导出只读 `RichContent`；可选的 `id`/`labelledBy`/`describedBy`/`invalid` 会写到可编辑区，供 `<Field>` 接上标签与错误 | `POST /api/upload` |
| `CommentSection` | 评论区：列表、发表、回复、编辑、删除 | `/api/comments*` |
| `AnswerForm` / `AnswerItem` / `AcceptButton` | 答题、展示（投票/采纳/编辑/删除）、采纳按钮 | `/api/questions/[id]/answers`、`/api/answers/[id]` |
| `VoteButtons` / `RatingWidget` / `BookmarkButton` | 顶踩投票、1–5 星评分、收藏开关 | `POST /api/votes`、`POST /api/bookmarks` |
| `ArticleEditButton` / `QuestionEditButton` / `SoftwareEditButton` | 详情页内的编辑弹窗 | 对应 `PUT /api/*/[id]` |
| `TagPicker` | 标签选择/联想 | `GET /api/tags` |
| `NotificationBell` | 导航栏通知铃铛（轮询 limit=10） | `/api/notifications*` |
| `TableOfContents` / `ReadingProgress` / `BackToTop` / `ShareButton` | 目录与滚动高亮、阅读进度、回到顶部、分享 | — |
| `ViewTracker` | 挂载后上报一次浏览 | `POST /api/views` |
| `Pagination` / `CodeBlock` | **无引用**（死代码；列表页各自实现了分页 UI） | — |

> 发布页的草稿自动保存（`localStorage`，键为 `publish:<类型>:<用户 id>`，7 天过期）与恢复横幅由
> `client/usePublishDraft.ts` 提供，属于 hook 而非组件，未计入上表；它不做 `beforeunload` 拦截——
> 内容已落盘，刷新最多丢失一个防抖窗口（800ms），回来时横幅可一键恢复。

### 公式（LaTeX）

`client/math-nodes.ts`（Tiptap 节点，非 .tsx 组件）与 `lib/math.ts`（渲染）构成一条链路：

| 环节 | 行为 |
|---|---|
| 编辑 | `$…$` / `$$…$$` 输入或粘贴时由 InputRule/PasteRule 转成 `mathInline` / `mathBlock` 原子节点，`data-latex` 保存源码；双击（或回车）打开对话框编辑，工具栏有 Σ（行内）与 √（块级）两个入口 |
| 存储 | 序列化为 `<span data-math="inline" data-latex="…">` / `<div data-math="block" …>`，`data-*` 在 `sanitizeHtml` 的白名单内（`ALLOW_DATA_ATTR: true`） |
| 渲染 | `renderMathInHtml()`：先识别节点，再处理 `$…$`、`$$…$$`、`\(…\)`、`\[…\]` 文本分隔符；`<code>`/`<pre>` 内跳过，`$5 and $10` 这类价格不会被误判 |
| 顺序 | **必须先净化再渲染**：KaTeX 需要内联 `style`，而白名单刻意不允许用户输入携带 `style`；KaTeX 用 `trust: false`，`\href` 之类不会生成链接 |
| 移动端/无服务端 | 服务端详情页（solutions/questions/software）与客户端 `RichContent`、编辑器预览共用同一函数；KaTeX CSS 在根 layout 引入（字体按需下载） |
| 回归 | `npm run math:check`（`scripts/check-math.ts`，18 个用例：分隔符、代码块跳过、价格不误判、节点往返、`trust` 关闭） |

> 文本 → Markdown 转换前会先把公式节点还原成 `$…$`（`mathElementsToDelimiters()`），否则 turndown
> 会静默丢弃自定义节点；Markdown 切回富文本时用 `insertContentAt(..., { applyInputRules: true })`，
> 让 `$…$` 文本重新变成节点。

### `components/layout/`（3）

`Navbar`（导航、搜索、主题切换、语言切换、通知、用户菜单、移动端抽屉）、`Footer`（服务端，读 `siteConfig`）、
`FooterClient`（后台隐藏页脚）。

### `components/admin/`（2）

`AdminFilters`（防抖搜索框 + 下拉筛选，写 URL query 并丢弃 `page`）、`AuditActionBadge`（审计动作徽章，
每个 action 一个显式 `case`，保证 i18n key 静态可达）。

### `components/` 根级（5）

`ThemeProvider`、`SessionProvider`、`HtmlLang`（按 locale 同步 `document.documentElement.lang`）、
`JsonLd`（服务端，`ArticleJsonLd` / `SoftwareJsonLd`，序列化时转义 `<`/`>`/`&`）、`Logo`。

---

## 五、SEO 与元数据

| 项 | 位置 | 说明 |
|---|---|---|
| `<title>` | 根 layout 给中文默认值 + `template: "%s \| Solution"`；`[locale]/layout.tsx` 按 locale 覆盖 | 站点名/描述/关键词取自 `siteConfig` 与 `common` 词条 |
| `metadataBase` | 根 layout | `NEXT_PUBLIC_SITE_URL \|\| http://localhost:3000` |
| OG / Twitter | 两处 layout | `og:locale` 按语言切换（`zh_CN` / `en_US`），`twitter:card = summary_large_image` |
| 图标 | `src/app/icon.svg` | 文件约定注入；**没有** `favicon.ico`、`apple-icon` |
| 分享图 | 两处 layout 引用 `/og-image.png` | **`public/` 下不存在该文件** → 分享图为 404（已知问题） |
| 结构化数据 | `JsonLd.tsx` | 仅 `/solutions/[slug]`（Article）与 `/software/[slug]`（SoftwareApplication）；**问答详情没有** |
| sitemap | `src/app/sitemap.ts` | `force-dynamic`；5 个静态页 + 每类最多 500 条，zh 与 en 各一套 |
| robots | `src/app/robots.ts` | 允许 `/`，禁止 `/api`、`/admin`、`/_next`、登录注册与个人页；含 sitemap 地址；后台另有 `noindex` |

---

## 六、已知行为差异（分析结论）

| # | 现象 | 说明 |
|---|---|---|
| 1 | **详情页 `revalidate` 声明基本不生效** | `/solutions/[slug]`、`/questions/[slug]`、`/software/[slug]` 都调了 `auth()`（读 cookie），实际按请求动态渲染 |
| 2 | **`settings` / `notifications` 的 `redirect("/login")` 丢 locale 前缀** | `/en` 用户被送到中文登录页；middleware 与 admin layout 都做了 `locale === "en"` 分支，只有这两处没有 |
| 3 | 全站**没有 `generateStaticParams`** | 动态段不做构建期枚举，首访走按需渲染 |
| 4 | 4 个无引用组件 | `ui/tabs`、`ui/toast`、`client/Pagination`、`client/CodeBlock` |
| 5 | 分享图与 favicon 缺失 | `/og-image.png` 被引用 4 次但文件不存在；`/favicon.ico` 也没有（标签页图标靠 `icon.svg`） |
| 6 | 问答详情缺 JSON-LD | 文章与软件有，问答没有（`QAPage`/`Question` 未实现） |
| 7 | `/admin/tags` 页码未钳制 | 其它后台列表页都会把 `page` clamp 到 `[1, totalPages]` |
| 8 | 链接库混用 | 后台已统一用 `@/i18n/routing`；前台仍有约 20 个文件直接 `import Link from "next/link"` 并手写带前缀路径 |
| 9 | `/api-docs` 页面 | 不在 locale 路由内、界面硬编码中文、端点清单已过期（见 [api-reference.md](./api-reference.md)） |
