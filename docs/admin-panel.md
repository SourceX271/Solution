# 管理后台

入口：`/admin`、`/en/admin`。共 **8 个模块**页面，全部 `force-dynamic`、全部 `noindex, nofollow`，
页面级鉴权在 `src/app/[locale]/admin/layout.tsx`。

历史背景见归档的 [`ADMIN-PANEL-ENHANCEMENT-2026-10.md`](./archive/ADMIN-PANEL-ENHANCEMENT-2026-10.md)（2026-10-04 快照）。

---

## 一、页面与能力

| 页面 | 能力 |
|---|---|
| `/admin/dashboard` | 6 张统计卡（用户/文章/问答/软件/评论/浏览量，含 **30 天真实环比**）、14 天堆叠柱状图（服务端 SVG，零依赖）、待办队列（待审草稿、无人回答、近 7 天抓取失败、已封禁账号，可下钻）、最新用户、最近审计、快捷入口 |
| `/admin/content` | 类型页签（文章/问答/软件）+ 状态筛选（**带每状态计数**）+ 排序（最新/最早/热度/评分）+ 标题搜索 + 表格（浏览量/回答数/评分/作者/时间）+ 行内查看/发布/编辑/删除 + **批量发布/下线/删除**（单次上限 200，带确认） |
| `/admin/content/[type]/[id]/edit` | 编辑标题、正文（Tiptap）、摘要、问题描述、分类、状态、标签；状态走白名单校验 |
| `/admin/comments` | 指标（总数/近 7 天/参与人数）+ 搜索（正文/作者/邮箱）+ 表格（含所属内容跳转、回复数）+ 删除（**明确提示子回复会保留**） |
| `/admin/users` | 筛选（搜索/角色/状态，带计数）+ 内容数 + 最近登录 + 角色下拉（自我与最后管理员自动禁用）+ 封禁/解封（可填原因）+ 删除（**要求输入目标邮箱确认**） |
| `/admin/users/[id]` | 8 项内容统计、最近发布、最近评论、与该账号相关的审计记录，复用同一套处置按钮 |
| `/admin/tags` | **计数漂移检测**（对比 `usageCount` 与 `_count` 实际引用）+ 编辑（名称/颜色/描述，slug 不可改）+ 合并 + 删除（`force` 可强删在用标签）+ 一键重算 |
| `/admin/crawler` | 源表格（启停/单源运行/删除）、**一键全量抓取**、日志按状态筛选与分页、指标卡（源数/近 24h 失败/最近成功时间） |
| `/admin/audit` | 审计日志：动作下拉 + 搜索（操作人/对象）+ 分页（25/页） |
| `/admin/settings` | 站点名称/描述/关键词/logo/联系邮箱/社交链接/页脚/ICP/精选内容/三个功能开关；带**脏数据检测**与保存 toast |

---

## 二、鉴权：三级防线

```
① middleware.ts        Edge，读 JWT 里的 role（登录时冻结）—— 只做重定向
② admin/layout.tsx     RSC，getSessionUser() 回库重读 role + bannedAt —— 页面兜底
③ requireAdminApi()    Route Handler，同样回库 —— 接口兜底
```

- ②③ 的判定是 `role === "ADMIN" && !bannedAt`，因此**降权/封禁对后台是即时生效的**（实测：DB 改 `USER` 后接口立刻 403、页面 307）。
- ① 仍基于 JWT，因此降权用户在 token 过期前仍会通过 middleware，但会在 ②③ 被拦住。
- 前台内容接口的「作者或管理员」旁路读的仍是 JWT 角色——那条路径**不在**本页的三级防线内，见 [security.md](./security.md)。

新增后台接口时：**必须**用 `requireAdminApi()`，不要自己读 `session.user.role`（AGENTS.md 约定）。

---

## 三、用户处置规则（`src/lib/admin-user-actions.ts`）

后台两条入口（`/api/admin/users/[id]` 与历史接口 `PUT /api/users`）共用同一套规则：

| 规则 | 结果 |
|---|---|
| 禁自我降权 / 自我封禁 / 自我删除 | 400 `selfDemote` / `selfBan` / `cannotDeleteSelf` |
| 至少保留一名可用管理员（降级、封禁、删除三条路径都校验） | 400 `lastAdmin` |
| 封禁 | 写 `bannedAt` + `banReason`；`authorize()` 直接拒绝登录；解封清空原因 |
| 删除账号 | **单事务（timeout 20s）**：删名下文章/问答/软件/回答 → 按 `targetType` 清多态 Vote/Bookmark → 删本人评论/投票/收藏/通知 → `Tag.createdBy` 置空 → 重算受影响问题的 `answerCount`，丢失采纳答案的问题回退 `open` → 删用户；**事务后**按实际持有数回退标签计数，再失效三类内容缓存 |
| 审计 | 仅在**实际发生变化**时写 `user.role.update` / `user.ban` / `user.unban` / `user.delete` |

> 封禁对**已登录的普通用户**不是即时的：站点用纯 JWT 会话且无 adapter，无法吊销既有令牌。
> 语义是「不能再登录」，而不是「立刻踢下线」。

---

## 四、审计日志

`AuditLog`（只追加）+ `src/lib/audit.ts` 的 `logAdminAction()`。**写入失败只 `console.error`，绝不抛出**，
所以审计是尽力而为，不影响主流程。

19 类动作（`AuditAction`）：

| 分组 | 动作 |
|---|---|
| 内容 | `content.update`、`content.delete`、`content.bulkPublish`、`content.bulkUnpublish`、`content.bulkDelete` |
| 评论 | `comment.delete` |
| 用户 | `user.role.update`、`user.ban`、`user.unban`、`user.delete` |
| 采集 | `crawler.source.create`、`crawler.source.update`、`crawler.source.delete`、`crawler.run` |
| 标签 | `tag.update`、`tag.delete`、`tag.merge`、`tag.recompute` |
| 站点 | `settings.update` |

记录字段：操作人 id + 邮箱、动作、对象类型/ID/名称、JSON 明细（截断 4000）、客户端 IP、时间。
`actorId` **故意不做外键**，删号后日志仍在。

---

## 五、缓存失效（`src/lib/revalidate.ts`）

后台写操作会失效**两种语言**（`""` 与 `/en` 两个前缀）的前台页面：

| 函数 | 失效范围 |
|---|---|
| `revalidateContentList(type)` | 对应列表页 + 首页 |
| `revalidateContent(type, slug?)` | 列表页 + 首页 + 详情页 + `/search` |
| `revalidateSiteConfig()` | 首页、`/solutions`、`/questions`、`/software`、`/about`、`/contact` |
| `revalidateTags(slugs)` | 首页 + 三个列表 + `/search` + 每个 `/tags/<slug>` |

前台自己的写接口（内容 PUT）只调了 `revalidateContent`；内容 **DELETE** 未失效缓存（见 [api-reference.md](./api-reference.md)）。

---

## 六、后台开发约定（新增功能时）

1. **接口**：`requireAdminApi()` 守卫 → zod 校验（`getApiT("api")` 取翻译）→ 业务 → `logAdminAction()` → `revalidate*()`。
2. **页面**：继承 `admin/layout.tsx` 的鉴权；列表页自己做 `page` 钳制（`[1, totalPages]`）。
3. **文案**：全部走 `messages/*.json` 的 `admin.*`（词条 423 个），两侧同时增删；`npm run i18n:check` 会拦截硬编码中文。
4. **链接**：用 `@/i18n/routing` 的 `Link`/`useRouter`，否则 `/en/admin` 会跳回中文站。
5. **交互**：破坏性操作要有确认（删除用户要求输入邮箱）；图标按钮同时给 `title` 与 `aria-label`；加载态用 `skeleton` + `aria-busy`。
6. **筛选器**：复用 `components/admin/AdminFilters.tsx`，它会把条件写进 URL query 并清除 `page`。

---

## 七、已知限制

1. `AuditActionBadge` 每个动作一个显式 `case`（保证 i18n key 静态可达），**新增动作时要同步加分支**，否则徽章退化为原始字符串。
2. `/api/admin/crawler/[id]/run` 的 404 文案与 `/api/admin/tags/recompute` 的失败消息仍是硬编码英文/字面量。
3. `CrawlSource.enabled` 只影响后台展示与手动触发，**不影响 cron 调度**（Python 侧源列表是硬编码的，见 [crawler.md](./crawler.md)）。
4. 后台表格的分页/筛选是服务端渲染 + URL query，没有导出 CSV、没有服务端排序持久化。
5. `/admin/tags` 的 `page` 未像其它列表页那样钳制到 `totalPages`。
6. 站点设置的 `logo` 只做长度校验（站点也用相对路径，故未强制 URL 格式）。
