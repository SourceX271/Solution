# 数据模型

数据库：**SQLite + Prisma 5**，schema 位于 `prisma/schema.prisma`，开发库 `prisma/dev.db`（已被 `.gitignore` 忽略）。
当前 **15 个模型**，**没有 migrations**，schema 变更依赖 `npx prisma db push`（详见文末「操作约定」）。

> 本文描述的是 `prisma/schema.prisma` 的当前状态（2026-10-06，15 个模型）。改动 schema 后请同步更新本文。

---

## 一、模型总览

| 模型 | 职责 | 关键约束 |
|---|---|---|
| `User` | 账号、角色、封禁、最近登录 | `email @unique`；`role` 默认 `"USER"`（`USER` / `ADMIN`） |
| `Tag` | 标签 | `name @unique`、`slug @unique`；`usageCount` 冗余计数 |
| `Article` | 解决方案（文章） | `slug @unique`；`status` 默认 `"published"`；`sourceUrl` 仅索引不唯一 |
| `Question` | 问题 | `slug @unique`；`status` 默认 `"open"`；`answerCount`/`voteCount` 冗余 |
| `Answer` | 回答 | 归属 `Question`（`onDelete: Cascade`）；`accepted` 布尔 |
| `Software` | 软件推荐 | `slug @unique`；`rating`/`ratingCount` 冗余 |
| `Comment` | 评论（含嵌套回复） | 自关联 `CommentReplies`，父级删除时 `SetNull`；挂四类目标之一 |
| `Vote` | 投票 / 评分 | `@@unique([userId, targetType, targetId])`；`value` 为 ±1 或 1–5 |
| `Bookmark` | 收藏 | `@@unique([userId, targetType, targetId])` |
| `Notification` | 站内通知 | `message` 存 `{"key","params"}` JSON；索引 `[userId, read]` |
| `CrawlSource` | 采集源元数据（后台可维护） | `enabled` 默认 true；**Python 侧源列表是硬编码的，见 crawler.md** |
| `CrawlLog` | 采集日志 | `sourceId` 只存字符串、**不做外键**，删源后日志保留 |
| `SiteConfig` | 站点配置（单行） | `id` 固定 `"main"`，通过 `upsert` 访问 |
| `SlugRedirect` | 旧 slug → 新 slug 的永久重定向映射 | `oldSlug @unique`；`targetType` = article/question/software |
| `AuditLog` | 后台操作审计（只追加） | `actorId`/`actorEmail` **故意不做外键**，删号后日志仍在 |

关系速写（`→` 为外键方向）：

```
User ─┬─< Article ─┬─< Comment
      ├─< Question ─┼─< Answer ──< Comment
      │            └─< Comment
      ├─< Software ──< Comment
      ├─< Answer
      ├─< Comment
      ├─< Vote        （多态：targetType + targetId）
      ├─< Bookmark    （多态）
      ├─< Notification
      └─< Tag         （Tag.createdBy，删用户时置 null）
Tag >──< Article / Question / Software   （隐式多对多）
Question ──< Answer（Cascade）
Comment ──< Comment（自关联 replies，SetNull）
```

---

## 二、状态机

| 模型 | 字段 | 取值 | 流转位置 |
|---|---|---|---|
| `Article` | `status` | `published`（默认）· `draft` | 采集入库固定 `draft`；后台批量发布/下线；`ALLOWED_STATUS` 白名单只允许这两个值 |
| `Article` | `category` | `solution`（默认）· `tutorial` · `guide` · `reference`（前台筛选器）/ 采集器还写 `news` | 前台只提供前四个；`news` 只由采集映射产生 |
| `Question` | `status` | `open`（默认）· `solved` · `closed` | 采纳答案 → `solved`；删除已采纳答案且当前为 `solved` → 回退 `open`；后台可设为 `open`/`closed`/`solved` |
| `Software` | `status` | `published`（默认）· `pending` · `draft` | 后台待审计数只统计 `pending` |
| `Software` | `category` | `tool`（默认）· `development` · `library` · `website` · `game` · `other` | 前台筛选器六项（`tool` 为默认） |
| `User` | `role` | `USER`（默认）· `ADMIN` | zod 枚举只接受这两个值；后台改角色/封禁有额外业务规则（见 admin-panel.md） |
| `User` | `bannedAt` | `null` / 时间戳 | 非空即禁止登录；`getSessionUser()` 与 `requireAdminApi()` 都会读它 |
| `Notification` | `read` | `false`（默认）/ `true` | 单条已读、全部已读 |
| `CrawlLog` | `status` | `success` / `error` | 由 `lib/crawler-ingest.ts` 按结果写入 |

> ⚠️ 类型文件漂移：`src/lib/types.ts` 的 `QuestionStatus` 只有 `open|answered|closed`（缺 `solved`、多了没人写入的
> `answered`），`ArticleCategory`/`SoftwareCategory` 与前台筛选器也不一致。**以 schema 与各页面的白名单为准**，
> 该文件当前更像历史遗留。

---

## 三、多态关联（`targetType` + `targetId`）

三类模型用字符串指向别的表，**数据库层没有外键**，所以删除内容时必须显式清理：

| 模型 | 允许的 `targetType` | 校验位置 | 清理位置 |
|---|---|---|---|
| `Comment` | `article` · `question` · `answer` · `software` | `POST /api/comments` 白名单 + 目标存在性回查 | 各删除路径；内容删除时由 `onDelete: Cascade` 带走（评论的目标字段是真实外键） |
| `Vote` | `article` · `question` · `answer` · `software` | `POST /api/votes` 白名单 + 存在性校验 | `purgeOrphans`（后台删除内容）、`deleteUserAccount`（删号） |
| `Bookmark` | `article` · `question` · `software`（**不含 answer**） | `POST /api/bookmarks` 白名单 | 同上 |

`Comment` 与内容之间是真实外键（`articleId`/`questionId`/`answerId`/`softwareId`，`onDelete: Cascade`），
但 `Vote`/`Bookmark` 不是——这是历史设计，新增内容类型时要同时改白名单与各清理点。

---

## 四、冗余计数字段（必须与真实数量保持一致）

| 字段 | 何时 +1 | 何时 -1 / 重算 |
|---|---|---|
| `Question.answerCount` | `POST /api/questions/[id]/answers`（事务内 +1） | `DELETE /api/answers/[id]`（事务内 `max(0, count-1)`）、`deleteUserAccount` 重算受影响问题 |
| `Question.voteCount` | `POST /api/votes`（新建 +value） | 取消回退 `-existing.value`；改向为 `value - existing.value`（同一事务） |
| `Answer.voteCount` | 同上 | 同上 |
| `Software.rating` / `ratingCount` | `POST /api/votes` 对 software 评分（1–5） | 交互式事务内 `aggregate` 重算并回写 `round(avg*10)/10` |
| `Tag.usageCount` | `bumpTagUsage(slugs, +1)`：创建内容、采集入库 | `bumpTagUsage(slugs, -1)`（删除内容、删号）、`syncTagUsage(prev, next)`（编辑换标签差集）、`recomputeTagUsage()`（后台「重算」，幂等）；`bumpTagUsage` 对负数做了「不递减到 0 以下」的钳制 |
| `Article.viewCount` / `Question.viewCount` | **两处**：`GET /api/articles|questions/[id]` 读时自增、`POST /api/views` 客户端打点 | 无递减；**software 没有浏览计数** |

`Article` 没有冗余投票计数（靠 `Vote` 表实时统计）；`Question` 的票数则同时存在冗余字段，改动时要注意两处一致。

---

## 五、Slug 与旧链接重定向

- **所有 slug 都是纯 ASCII 随机串**：`generateSlug()` = `Date.now().toString(36) + Math.random().toString(36).slice(2,8)`，
  不含标题文字，避免中文 URL 在 nginx / 缓存 / 分享场景失效。
- 标签 slug 有例外路径：`resolveTags()` 会先把标签名正规化成 ASCII（`C++` → `c`），得到非空结果就复用；
  中文标签则按 `name` 查重，未命中时用随机串，保证 `/tags/<slug>` 始终是 ASCII。
- 历史中文 slug 的映射写在 `SlugRedirect` 表：详情页查不到内容时调用
  `resolveSlugRedirect(targetType, oldSlug)`，命中则 `permanentRedirect()`（308）到新地址；迁移脚本见 `prisma/seed-redirects.ts`。
  > 该查询走 `$queryRawUnsafe` + 参数占位符，是为了不依赖 `prisma generate` 生成的新模型类型（见
  > [dev-environment.md](./dev-environment.md) 第 5 节）。

---

## 六、审计与配置

### `AuditLog`（只追加）

- 字段：`actorId`、`actorEmail?`、`action`、`targetType?`、`targetId?`、`targetLabel?`、`metadata?`（JSON，截断 4000）、`ip?`、`createdAt`。
- `action` 是 19 个枚举值之一（`src/lib/audit.ts` 的 `AuditAction`）；`targetLabel` 截断 200。
- **`actorId` 不是外键**：删号后审计仍在；写入失败只 `console.error`，绝不抛出，因此审计是「尽力而为」而非强一致。
- 读取入口：`/admin/audit`（按动作、搜索、分页）与仪表盘「最近操作」。

### `SiteConfig`（单行）

- 通过 `prisma.siteConfig.upsert({ where: { id: "main" }, … })` 访问，避免并发首访撞 `P2002`。
- 前台使用：Navbar/Footer 站点名与描述、`/contact` 邮箱、`enableSolutions/Questions/Software` 开关、`featured*` 精选。
- 后台表单用 `__none__` 作为「未选择」哨兵，**写库前归一化为 `null`**；空串同样归一化为 `null`。

---

## 七、索引与已知冗余

已建索引（`schema.prisma`）：`User.email/role`、`Tag.slug/usageCount`、`Article.slug/status/category/authorId/createdAt/sourceUrl`、
`Question.slug/status/authorId/createdAt`、`Answer.questionId/authorId`、`Software.slug/category/status/(rating,createdAt)`、
`Comment.parentId/各目标 id/authorId`、`Vote(targetType,targetId)/userId`、`Bookmark.userId`、`Notification(userId,read)`、
`CrawlSource.enabled`、`CrawlLog.sourceId/createdAt`、`SlugRedirect.targetType/newSlug`、`AuditLog.createdAt/actorId/action`。

已知冗余（保留但应知悉）：

- `User.email`、`Tag.slug`、`Article.slug`、`Question.slug`、`Software.slug` 上 `@unique` 已隐含索引，
  额外的 `@@index` 是重复的。
- `Article.sourceUrl` 只建了索引、**不是唯一索引**：采集去重靠应用层 `findFirst`，多实例并发下可能重复入库。

---

## 八、操作约定

```bash
npm run db:push      # npx prisma db push —— 同步 schema（无 migrations）
npm run db:generate  # npx prisma generate —— 新模型/字段的类型
npm run db:seed      # tsx prisma/seed.ts —— 幂等种子数据（密码可用 SEED_*_PASSWORD 覆盖）
npm run db:studio    # prisma studio —— 图形化查看
```

- **改 schema 的流程**：改 `schema.prisma` → `npx prisma db push` → `npx prisma generate` → 更新本文与相关文档。
  新增列务必可空或带默认值，否则 SQLite 上的既有数据会丢（AGENTS.md 的硬性约定）。
- **生产**：容器内没有 Prisma CLI；镜像构建期 `db push` 生成一次 schema 快照（`/app/prisma-template.db`），
  首次启动由 `docker-entrypoint.sh` 复制成真实库。**schema 变更后旧数据卷不会自动升级**，
  需重置数据卷或自行迁移，详见 [operations.md](./operations.md)。
- **备份**：SQLite 单文件，备份 `app-data` 卷里的 `dev.db` 即可（DEPLOY.md 有 crontab 示例）。
- 上述 CLI 在 DSH 沙箱里会 `spawn EPERM`（见 [dev-environment.md](./dev-environment.md) 第 5 节），请在普通终端执行。
