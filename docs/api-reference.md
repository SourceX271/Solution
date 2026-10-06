# 接口参考（REST API）

`src/app/api/**` 共 **41 个 `route.ts`、66 个导出处理方法**（57 个 `export async function` + 7 个 `apiHandler()` 包装 +
NextAuth catch-all 的 GET/POST 再导出）。本文按资源列出「路径 / 方法 / 鉴权 / 入参 / 响应 / 副作用」。

> ⚠️ 站点里还有一个对外可见的 `/api-docs` 页面，它是开发期手写的目录，**已与实现不符**（列出了不存在的
> `/api/crawler/run`、`/api/admin/content`、`/api/admin/users`、`POST /api/answers` 等）。**以本文为准**，
> 修页面或删页面的决断见文末「已知不一致」。

---

## 一、通用约定

| 项 | 约定 |
|---|---|
| 基础路径 | `/api/**`，无版本前缀 |
| 认证 | Session Cookie（next-auth，`auth()` / `requireAdminApi()`）；无 Bearer Token |
| 请求/响应体 | JSON（上传接口为 `multipart/form-data`，RSS 返回 XML） |
| 动态段 | Next 15 起 `params` 是 **Promise**，处理器内 `await ctx.params` 后使用 |
| 错误消息语言 | 由 `NEXT_LOCALE` cookie 决定（`src/lib/api-i18n.ts`）——API 不在 next-intl 中间件覆盖范围内 |
| 管理员判定 | `/api/admin/**` 与 `apiHandler({auth:"admin"})` **回库重读** `role`+`bannedAt`；其余接口的「作者或管理员」旁路读的是 **JWT 里冻结的 `role`** |

### 鉴权四档

| 档位 | 实现 | 命中范围 |
|---|---|---|
| 公开 | 无校验 | 各内容列表/详情 GET、`/api/tags` GET、`/api/search`、`/api/rss`、`/api/views` POST |
| 需登录 | `const session = await auth(); if (!session) 401` | 内容创建、投票、收藏、上传 |
| 需登录（包装） | `apiHandler({ auth: "required" })` | `/api/users/me*`、`/api/users/profile`、`/api/notifications*` |
| 需管理员 | `requireAdminApi()`（回库） | 全部 `/api/admin/**`、`GET/PUT /api/users` |

### 响应格式（**三种并存**，前端需分别处理）

| 形态 | 例子 | 出现位置 |
|---|---|---|
| `{ success, data, total, page, limit, totalPages }` | `apiHandler` 系列、多数 admin 接口 | notifications、users/me、admin/* |
| `{ data, total, page, limit }`（无 `success`） | 内容列表 | articles、questions、software、`GET /api/users` |
| 裸数组 / 自定义 | `/api/tags` GET 返回数组；`/api/bookmarks` GET 返回数组；`/api/comments` GET 返回 `{comments}`；`/api/search` 返回 `{data, query}`；`/api/votes` GET 返回 `{upVotes,downVotes,userVote}` | 见下 |

错误体：`{ error: string }`（裸 `auth()` 路由）或 `{ success: false, error }`（`apiHandler`），消息已本地化。
**非法 JSON body** 在未走 `apiHandler` 的路由会落进 `catch` 返回 **500**（而非 400）。

### 分页与限额

| 位置 | 参数 | 默认 | 上限 |
|---|---|---|---|
| 通用（`lib/errors.ts` 的 `getPaginationParams`） | `page` / `limit` | 1 / 10 | limit ≤ 100 |
| articles、questions、software 列表 | `page` / `limit` | 1 / 10 | 100 |
| `GET /api/users`、`/api/admin/tags` | `page` / `limit` | 1 / 20 | 100 |
| `GET /api/tags` | `limit` | 20 | clamp 1–50 |
| `GET /api/search` | 无分页 | 每类 5 条 | — |

非法数值（`?page=abc`）由 `toPositiveInt` 兜成默认值，不会 500。

### 限流（进程内存，多实例不共享）

| 接口 | 额度 | 键 |
|---|---|---|
| 登录（Credentials） | 10 次 / 10 分钟 | `ip:login:<email>` |
| 注册 | 5 次 / 60 秒 | `ip:register` |
| 改密 | 5 次 / 15 分钟 | `ip:password-change` |
| 发回答 | 10 次 / 60 秒 | `ip:answer` |
| 发评论 | 10 次 / 30 秒 | `ip:comment` |
| 创建标签 | 10 次 / 60 秒 | `ip:tag` |
| 投票/评分 | 30 次 / 60 秒 | `ip:vote` |
| 上传 | 10 次 / 60 秒 | `ip:upload` |

超限统一返回 **429**，消息为 `api.rateLimited*` 系列词条。

### 入参校验（`src/lib/validations.ts`，zod 工厂，错误消息按语言翻译）

| 工厂 | 字段与限制 |
|---|---|
| `getRegisterSchema` | `name` 2–50、`email`、`password` 8–100 且含字母+数字 |
| `getLoginSchema` | `email`、`password` ≥8 |
| `getArticleSchema` | `title` 2–200、`content` 10–100000、`excerpt` ≤500、`problem` ≤2000、`category` ≥1、`tags`、`status` ∈ {draft, published} |
| `getQuestionSchema` | `title` 5–200、`content` 20–50000、`tags` |
| `getAnswerSchema` | `content` 10–50000 |
| `getCommentSchema` | `content` 1–2000（目标字段不在 schema 内，另行校验） |
| `getSoftwareSchema` | `name` 1–100、`description` 10–5000、`url`（url 或空串）、`category` ≥1、`tags` |
| `getProfileSchema` | `name` 2–50、`bio` ≤500、`image` ≤500（`""` / http(s) / `/` 开头） |
| `getPasswordChangeSchema` | `currentPassword` 1–200、`newPassword` 8–72 且含字母+数字 |

---

## 二、认证与账号

| 路径 | 方法 | 鉴权 | 入参 | 响应 | 副作用 |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 自管 | NextAuth 协议 | 标准 | — |
| `/api/auth/register` | POST | 公开 | `{name,email,password}` | 201 `{id,name,email}`；400（校验失败/邮箱已存在）；429；500 | 限流 5/60s；bcrypt 12 轮；**不**写审计 |
| `/api/users/me` | PUT | 登录 | `getProfileSchema`（只写传入字段） | `{success,data:{id,name,email,image,bio}}` | — |
| `/api/users/me/password` | PUT | 登录 | `getPasswordChangeSchema` | `{success,data:{message}}`；400 `passwordOAuth`/`passwordWrong`/`passwordSame`；429 | 限流 5/15min；bcrypt rehash |
| `/api/users/profile` | GET | 登录 | — | `{success,data:{user,stats,bookmarks(≤20),recentActivity(≤10)}}` | — |
| `/api/users/[id]` | GET | 可选登录 | — | 用户公开信息 + `_count`；**`email` 仅本人或管理员可见** | — |
| `/api/users/[id]` | PUT | 登录且**只能改自己** | `getProfileSchema` | 200；403 `profileUpdateSelfOnly` | — |
| `/api/users` | GET | **管理员** | `page`(1) `limit`(20,≤100) `search` | `{data,total,page,limit}` + `_count.{articles,questions,answers}` | — |
| `/api/users` | PUT | **管理员** | `{userId, role}`，role ∈ {USER, ADMIN} | 200；400 `missingParams`/`invalidRole`/`selfDemote`/`selfBan`/`lastAdmin`；404 | 走 `updateUserAccount` → 审计；不失效缓存 |

> `PUT /api/users` 是历史接口，现已复用与 `/api/admin/users/[id]` 相同的业务规则（禁止自我降权/封禁、至少留一名管理员）。

---

## 三、解决方案（Article）

| 路径 | 方法 | 鉴权 | 入参 | 响应 | 副作用 |
|---|---|---|---|---|---|
| `/api/articles` | GET | 公开 | `page`(1) `limit`(10) `category` `status`(默认 `published`) `search` | `{data,total,page,limit}`（含 author、`_count.comments`） | — |
| `/api/articles` | POST | 登录 | `getArticleSchema` | 201 文章 | `generateSlug()`；`resolveTags` + `bumpTagUsage(+1)`；**不写审计、不失效缓存** |
| `/api/articles/[id]` | GET | 公开 | — | 文章 + author + 评论（倒序） | **读时 `viewCount` +1**（与 `/api/views` 重复计数） |
| `/api/articles/[id]` | PUT | 作者或 **JWT 中的 ADMIN** | `getArticleSchema` | 200；403 `noPermissionEdit`/`noPermission`；404 | `buildTagUpdate`+`syncTagUsage`；`revalidateContent("articles", slug)` |
| `/api/articles/[id]` | DELETE | 同上 | — | 200 `{message}` | `bumpTagUsage(-1)`；**未失效缓存** |

## 四、问答（Question / Answer）

| 路径 | 方法 | 鉴权 | 入参 | 响应 | 副作用 |
|---|---|---|---|---|---|
| `/api/questions` | GET | 公开 | `page`(1) `limit`(10) `status` `search` `tag`(slug) | `{data,total,page,limit}` | — |
| `/api/questions` | POST | 登录 | `getQuestionSchema` | 201 | slug、标签计数 +1 |
| `/api/questions/[id]` | GET | 公开 | — | 问题 + 作者 + **仅 `accepted: true` 的回答** | **读时 `viewCount` +1** |
| `/api/questions/[id]` | PUT | 作者或 JWT ADMIN | `getQuestionSchema` | 200；403 `noPermissionEdit` | `syncTagUsage`；`revalidateContent("questions", slug)` |
| `/api/questions/[id]` | DELETE | 同上 | — | 200 | `bumpTagUsage(-1)`；**未失效缓存** |
| `/api/questions/[id]/answers` | POST | 登录 | `getAnswerSchema` | 201 回答；404（问题不存在）；429 | 限流 10/60s；`sanitizeHtml`；**事务**：回答 + `answerCount+1`；通知提问者（`type:"answer"`） |
| `/api/answers/[id]` | PUT | 作者或 JWT ADMIN | `getAnswerSchema` | 200 | `sanitizeHtml` |
| `/api/answers/[id]` | DELETE | 作者或 JWT ADMIN | — | 200 | **事务**：`answerCount = max(0, count-1)`；若删除的是已采纳答案且问题为 `solved` → 回退 `open` |
| `/api/answers/[id]` | PATCH | **仅提问者** | 无 body | 200 采纳后的回答；403 `onlyAskerCanAccept` | **事务**：清空同问题其它 `accepted` → 本条 `accepted:true` → 问题 `status:"solved"`；通知答主（`type:"accepted"`） |

## 五、软件（Software）

| 路径 | 方法 | 鉴权 | 入参 | 响应 | 副作用 |
|---|---|---|---|---|---|
| `/api/software` | GET | 公开 | `page`(1) `limit`(10) `category`；固定 `status:"published"` | `{data,total,page,limit}` | — |
| `/api/software` | POST | 登录 | `getSoftwareSchema` | 201 | slug、标签计数 +1 |
| `/api/software/[id]` | GET | 公开 | — | 软件 + 作者 + 评论 | **不自增浏览量** |
| `/api/software/[id]` | PUT | 作者或 JWT ADMIN | `getSoftwareSchema` | 200；403 `noPermissionEdit` | `url` 空串转 `null`；`syncTagUsage`；`revalidateContent("software", slug)` |
| `/api/software/[id]` | DELETE | 作者或 JWT ADMIN | — | 200 | `bumpTagUsage(-1)`；**未失效缓存** |

## 六、评论 / 投票 / 收藏 / 浏览

| 路径 | 方法 | 鉴权 | 入参 | 响应 | 副作用 |
|---|---|---|---|---|---|
| `/api/comments` | GET | 公开 | **必填** `targetType` `targetId` | 200 `{comments}`（含 author，升序） | — |
| `/api/comments` | POST | 登录 | `content`（zod）+ 原始 body 里的 `targetType`/`targetId`/`parentId` | 201 评论；400 `missingTarget`/`invalidTargetType`/`replyTargetMissing`；404；429 | 限流 10/30s；目标白名单 + 存在性 + 父评论同目标校验；通知目标作者 |
| `/api/comments/[id]` | PUT | 作者或 JWT ADMIN | `getCommentSchema` | 200 | — |
| `/api/comments/[id]` | DELETE | 作者或 JWT ADMIN | — | 200 | 先把子评论 `parentId` 置 `null`（回复保留）再删除 |
| `/api/votes` | GET | 可选登录 | **必填** `targetType` `targetId` | `{upVotes,downVotes,userVote}` | — |
| `/api/votes` | POST | 登录 | `{targetType,targetId,value}`；目标须存在 | software：`value` 1–5 → `{voted,rating,ratingCount}`；其他：`value` ±1 → 新建 201 / 改向 / 取消 200 | 限流 30/60s；software 走交互式事务重算 `rating`；question/answer 同步冗余 `voteCount`（article 不同步） |
| `/api/bookmarks` | GET | 登录 | — | **裸数组**（倒序） | — |
| `/api/bookmarks` | POST | 登录 | `{targetType,targetId}`（article/question/software） | 新增 201 `{bookmarked:true,…}` / 取消 200 `{bookmarked:false,…}` | 取消分支不再校验目标是否仍存在 |
| `/api/views` | POST | **公开** | `{targetType: article\|question, targetId}` | `{success:true}`；400；404 | `viewCount` +1（与详情 GET 的自增并存） |

## 七、标签 / 搜索 / 通知 / 上传 / RSS

| 路径 | 方法 | 鉴权 | 入参 | 响应 | 副作用 |
|---|---|---|---|---|---|
| `/api/tags` | GET | 公开 | `q` `limit`(20) | **裸数组**，按 `usageCount` 降序 | — |
| `/api/tags` | POST | 登录 | `{name,slug,color,description}`（手写校验） | 201；400 系列；409 `tagExists`；429 | 限流 10/60s；slug 非 ASCII 时回退 `generateSlug()` |
| `/api/search` | GET | 公开 | `q`（必填） | `{data:[{type,...}], query}`，每类 5 条 | — |
| `/api/notifications` | GET | 登录 | `page`(1) `limit`(10) | `{success,data,total,page,limit,totalPages}` | — |
| `/api/notifications/[id]` | PATCH | 登录（仅本人） | — | `{success,data:{message}}`；403 | 置 `read:true` |
| `/api/notifications/[id]` | DELETE | 登录（仅本人） | — | `{success,data:{message}}`；403 | — |
| `/api/notifications/mark-all` | POST | 登录 | — | `{success,data:{message}}` | 全部置已读 |
| `/api/upload` | POST | 登录 | `multipart/form-data`，字段 `file` | `{success,url:"/uploads/avatars/<uuid>.<ext>"}`；400 系列；429 | 限流 10/60s；MIME 白名单（jpeg/png/gif/webp）+ **magic byte 嗅探**；≤2MB；文件名只用 `randomUUID()` |
| `/api/rss` | GET | 公开 | — | XML（`application/xml`，`Cache-Control: max-age=3600`） | `force-dynamic`；最新 20 篇 published 文章；`<language>` 跟随 `NEXT_LOCALE` |

## 八、管理后台

以下全部先执行 `requireAdminApi()`（未登录 401 / 非活跃管理员 403，消息已本地化）。

| 路径 | 方法 | 入参要点 | 副作用 |
|---|---|---|---|
| `/api/admin/stats` | GET | — | 统计 + `pending.{drafts,unansweredQuestions,failedCrawls,bannedUsers}` + 30 天环比 |
| `/api/admin/settings` | GET | — | `upsert` 单行配置 |
| `/api/admin/settings` | PUT | 全字段可选；空串/`__none__` → `null` | 审计 `settings.update`；`revalidateSiteConfig()` |
| `/api/admin/content/[type]/[id]` | PUT | `type` ∈ articles/questions/software；字段按类型白名单；`status` 走 `ALLOWED_STATUS` | 审计 `content.update`；`syncTagUsage`；`revalidateContent` |
| `/api/admin/content/[type]/[id]` | DELETE | 同上 | 删除 + 清理 Vote/Bookmark + `bumpTagUsage(-1)`；审计 `content.delete`；`revalidateContent` |
| `/api/admin/content/bulk` | POST | `{type,action: publish\|unpublish\|delete, ids[1..200]}` | 事务删除 + 标签回退；审计 `content.bulk*`；`revalidateContentList` |
| `/api/admin/comments/[id]` | DELETE | — | 删评论（子回复保留）；审计 `comment.delete`；按目标 `revalidateContent` |
| `/api/admin/users/[id]` | PUT | `{role?,banned?,banReason?}` | 审计 `user.role.update`/`user.ban`/`user.unban`；规则见 [admin-panel.md](./admin-panel.md) |
| `/api/admin/users/[id]` | DELETE | — | 事务级级联清理（超时 20s）+ 标签回退 + `revalidateContentList`；审计 `user.delete` |
| `/api/admin/crawler` | POST | `{name,url,category?,enabled?}` | 审计 `crawler.source.create` |
| `/api/admin/crawler/[id]` | PUT / DELETE | 同上（PUT 全字段可选） | 审计 `crawler.source.update`/`delete`；删除**保留** CrawlLog |
| `/api/admin/crawler/run` | POST | `?source=<key>`（可选） | `runCrawler()`（进程内互斥）；审计 `crawler.run` |
| `/api/admin/crawler/[id]/run` | POST | 路径 id 为 `CrawlSource.id`，名称需能映射到 CLI key | 成功后更新 `lastRun`；审计 `crawler.run`（`scope: single`） |
| `/api/admin/tags` | GET | `q` `page`(1) `limit`(20) | 返回 `actualCount`（三类内容实际引用数）用于漂移检测 |
| `/api/admin/tags/[id]` | PUT | `{name?,color?,description?}`（**slug 不可改**） | 审计 `tag.update`；`revalidateTags`；同名冲突 409 |
| `/api/admin/tags/[id]` | DELETE | `?force=1` 可强制（usage>0 时默认 409 `tagInUse`） | `detachTagEverywhere` + 审计 `tag.delete` + `revalidateTags` |
| `/api/admin/tags/merge` | POST | `{sourceId,targetId}` | 合并后重算计数；审计 `tag.merge`；`revalidateTags` |
| `/api/admin/tags/recompute` | POST | — | `recomputeTagUsage()`；审计 `tag.recompute`；`revalidateTags()` |

---

## 九、已知不一致与坑（分析结论）

| # | 现象 | 影响 / 位置 |
|---|---|---|
| 1 | **响应格式三种并存**（含 `success` / 不含 / 裸数组） | 前端要写 `d.success !== false ? d.data : d` 这类兼容逻辑，新接口容易踩 |
| 2 | **非法 JSON → 500** | 未走 `apiHandler` 的路由直接 `await req.json()` 抛错进 `catch` |
| 3 | **前台 DELETE 不失效缓存** | `/api/articles|questions|software/[id]` 的 DELETE、评论/回答的增删改都不调 `revalidate*`，前台最长等 ISR 过期 |
| 4 | **浏览量三处入口** | 两个详情 GET 读时自增 + `/api/views` 客户端打点；无去重、`/api/views` 无鉴权；software 完全没有浏览计数 |
| 5 | **JWT 角色旁路** | 内容写接口的管理员判断读 JWT（登录时冻结），被降权的管理员在 token 过期前仍可改删内容；`/api/admin/**` 已回库 |
| 6 | **`/api/admin/crawler/[id]/run` 的 404 文案硬编码英文** | `"Source not found"`，未走 i18n；`/api/admin/tags/recompute` 的失败消息同样是字面量 |
| 7 | **标签创建挂在公开路由** | `POST /api/tags`（仅需登录）是后台标签的唯一创建入口，`/api/admin/tags` 只有 GET |
| 8 | **`/api-docs` 页面与实际不符** | 见文首提示；它是唯一被 `i18n:check` 白名单豁免的界面文件 |
| 9 | **`GET /api/users/[id]` 的邮箱可见性** | 依 `isOwner \|\| isActiveAdmin(viewer)` 判定，普通访客拿不到 `email`（有意） |
| 10 | **限流为进程内存** | 多实例/多容器部署下额度不共享，重启即清空 |
