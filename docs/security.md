# 安全模型

本文汇总站点的认证、授权、输入处理、响应头与密钥现状，以及**仍需人工处理**的风险。
依赖漏洞的处置单独记录在 [dependency-audit-2026-10.md](./dependency-audit-2026-10.md)。

---

## 一、认证

| 项 | 实现 |
|---|---|
| 方案 | NextAuth v5 beta（Auth.js），**纯 JWT 会话**（无 Prisma adapter、无 DB session 表） |
| Provider | GitHub OAuth + Credentials（邮箱密码，bcrypt 12 轮） |
| 会话 token | `jwt` 回调写入 `id`、`role`；`session` 回调回填 `session.user.id/role` |
| 登录页 | `pages.signIn = "/login"`（自定义页）；`trustHost: true`（因此不需要 `AUTH_URL`/`NEXTAUTH_URL`） |
| 登录防护 | 按 `ip:login:<email>` 限流 **10 次 / 10 分钟**；`bannedAt` 非空直接拒绝；无 `passwordHash`（OAuth 账号）拒绝密码登录；`lastLoginAt` 尽力而为地异步更新 |
| 注册防护 | 按 IP 限流 5 次 / 60 秒；zod 校验密码 ≥8 位且含字母与数字 |
| 改密防护 | 按 IP 限流 5 次 / 15 分钟；校验旧密码；禁止新旧相同 |

**已知结构性限制（无 adapter 的代价）**

1. **GitHub OAuth 用户不在 `User` 表**：登录后 `session.user.id` 是 GitHub 的 id，写评论/回答/收藏会因外键失败，
   也不会出现在后台用户列表里。修复需要引入 `@auth/prisma-adapter`，或在**校验邮箱归属之后**再做账号关联
   （当前注册不验证邮箱，直接按邮箱合并会造成账号接管风险，故未擅自实现）。
2. **封禁/降权对已登录的普通用户不是即时的**：无法吊销既有 JWT。后台权限因**回库重读**而是即时的。
3. **除 NextAuth 自带的 CSRF 机制外，业务接口没有额外的 CSRF token**（`src/` 中无相关代码）；
   写接口依赖同源 `fetch` + Session Cookie。

---

## 二、授权：分层判定

| 层 | 判定依据 | 覆盖范围 | 是否回库 |
|---|---|---|---|
| `middleware.ts` | JWT 里的 `role` | 页面重定向（`/admin/**`、受保护页、登录/注册页互斥） | ✗ |
| `admin/layout.tsx` | `getSessionUser()`：会话 id → **数据库**读 `role`+`bannedAt` | 所有后台**页面** | ✓ |
| `requireAdminApi()` | 同上 | 所有 `/api/admin/**`、`GET/PUT /api/users` | ✓ |
| `apiHandler({ auth: "admin" })` | 同上 | 使用该包装的接口 | ✓ |
| 内容写接口的作者/管理员旁路 | `getSessionUser()` + `isActiveAdmin()`（2026-10-07 前是 JWT 里的 `role`） | `/api/articles\|questions\|software\|answers\|comments/[id]` 的 PUT/DELETE/PATCH | ✓ |

> 上表最后一行过去是最大的授权缺口：**被降权或被封禁的管理员，在 token 过期前仍可通过前台内容接口
> 修改/删除任何内容**。2026-10-07 已把 5 个文件的判定统一换成回库判定（`isActiveAdmin(await getSessionUser())`），
> 仅在调用者不是作者时才多一次查询。

自我操作类规则（不依赖角色）：`PUT /api/users/[id]` 要求 `params.id === session.user.id`；
后台的用户处置规则见 [admin-panel.md](./admin-panel.md) 第三节。

---

## 三、输入处理与输出编码

| 面 | 措施 | 位置 |
|---|---|---|
| 请求体校验 | zod 工厂（`getXSchema(t)`），长度/枚举/格式都在服务端强制 | `src/lib/validations.ts` |
| 分页参数 | `toPositiveInt` 兜底（`?page=abc` 不再 500） | `src/lib/errors.ts` |
| 富文本入库 | `sanitizeHtml()`：DOMPurify 白名单后落库（回答、评论等） | `src/lib/sanitize.ts` |
| 富文本渲染 | 详情页 `render` → `highlight` → `sanitizeHtml` 全链路再做一次净化 | `lib/render.ts`、`lib/highlight.ts`、各详情页 |
| Markdown | `marked`（`breaks` + `gfm`）；**结果必须由调用方净化** | `src/lib/render.ts` |
| LaTeX 公式 | 渲染在 `sanitizeHtml` **之后**：`renderMathInHtml()` 用 `katex.renderToString(..., { trust: false })`，`\href`/`\htmlClass` 等不会产出链接或标签；因为 KaTeX 输出带内联 `style`，若先渲染再净化反而会破坏公式（也正是白名单不允许用户输入带 `style` 的原因） | `src/lib/math.ts`、各详情页 |
| 上传 | MIME 白名单（jpeg/png/gif/webp，**不含 SVG**）+ **magic byte 嗅探**（不信 Content-Type）+ ≤2MB + 文件名只用 `randomUUID()` | `src/app/api/upload/route.ts` |
| JSON-LD | 序列化时把 `<` `>` `&` 转义为 `\u003c` 等，防 `</script>` 逃逸 | `src/components/JsonLd.tsx` |
| 开放重定向 | 登录页 `callbackUrl` 只接受以 `/` 开头且非 `//`、`/\` 的站内相对路径 | `(auth)/login/page.tsx` |
| URL 注入 | slug 一律 ASCII 随机串；标签 slug 也强制 ASCII | `lib/utils.ts`、`lib/tags.ts` |
| 命令注入 | 采集调用改 `execFile` + 参数数组，`source` 走白名单 | `lib/crawler-ingest.ts` |
| 多态目标 | `targetType` 白名单 + 目标存在性回查 | votes / bookmarks / comments |
| 请求体容错 | 所有路由用 `readJson(req)`（内部 try/catch → `null`），非法 JSON 一律 **400** 而非 500；`votes`/`bookmarks` 另有 zod 校验（`null` body 不再抛 `TypeError`） | `src/lib/request.ts`、各 `route.ts` |
| XML 输出 | `/api/rss` 的所有插值过 `escapeXml()`，CDATA 内的 `]]>` 转为 `]]]]><![CDATA[>`（否则改个昵称就能让整个 feed 变成非良构 XML，或在标题里注入任意 item） | `src/app/api/rss/route.ts` |
| 删除清理 | 删除内容时显式清理多态 `Vote`/`Bookmark`（含 `targetType="answer"`，以及问题级联删除下的答案投票）：`purgeContentRelations()` 在删除前的同一事务内执行 | `src/lib/content-purge.ts` |

**当前 DOMPurify 白名单**（`src/lib/sanitize.ts`）：

- 允许标签：h1–h6、p、br、hr、ul/ol/li、strong/b/em/i/s/u/mark、a、img、code、pre、blockquote、
  table 系列、div、span、input、label；
- 允许属性：`href,target,rel,src,alt,width,height,loading,class,id,style,type,checked,disabled,data-language`，
  且 `ALLOW_DATA_ATTR: true`；
- URI 白名单：`http(s)/ftp`、`mailto:`、`tel:`、站内 `/` 与 `#`。

> 仍放行 `style` 属性与 `class`/`id`，在「用户可提交 HTML」的场景下属于偏宽的配置（CSS 注入/样式破坏而非脚本执行）。
> 归档审计已把它列为低优先级待收紧项。

---

## 四、限流

统一实现：`src/lib/rate-limit.ts`（**进程内存 Map**，多实例不共享，重启清空）。
各接口额度见 [api-reference.md](./api-reference.md) 的「限流」表。

**限流 key 的可信来源（2026-10-07 修复）**：`X-Forwarded-For` 是客户端可伪造的请求头，
早期实现直接取它的第一跳作为 IP，等于把额度交给攻击者控制——每换一个伪造 IP 就得到一个新桶，
登录防爆破（10 次/10 分钟）与注册/评论/上传/投票额度全部可无限绕过；另一方面不带该头的请求
会共用一个 `unknown:*` 桶，一个人就能把全站额度打满。

现在：

- `getClientIp(req)` **只在 `TRUST_PROXY=1` 时**采信代理头，并取**最后一跳**（nginx 用
  `$proxy_add_x_forwarded_for` 追加对端地址，客户端伪造的值留在左边）；否则返回 `null`。
- key 形如 `ip:<addr>:<suffix>`；拿不到可信 IP 时退化为 `direct:<suffix>`。
  登录的 suffix 仍含邮箱（`login:<email>`），因此**针对已知账号的撞库依旧被限制**，
  与是否有 IP 无关。
- 审计记录（`logAdminAction` 的 IP 字段）复用同一个 `getClientIp`，伪造的头不会进审计表。
- 反向代理部署（nginx/Caddy/云 LB）请设置 `TRUST_PROXY=1`；直连部署（`docker-compose` 直接把
  3000 端口对外）保持不设置。无 IP 时额度是"全局的同 suffix 桶"，属于已知取舍（见第六节）。

---

## 五、响应头与 CSP

`next.config.mjs` 的 `headers()`：

| 范围 | 头 |
|---|---|
| 所有非 `/api` 路径 | `Content-Security-Policy`、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy: camera=(), microphone=(), geolocation=()`、`X-DNS-Prefetch-Control: on` |
| `/api/**` | 只给 `nosniff`、`X-Frame-Options`、`Referrer-Policy` |

CSP 要点：`default-src 'self'`；`script-src 'self' 'unsafe-inline' https:`（**`'unsafe-eval'` 仅开发模式追加**）；
`style-src 'self' 'unsafe-inline' https:`；`object-src 'none'`；`frame-ancestors 'none'`；`form-action 'self'`；`base-uri 'self'`。

`'unsafe-inline'` 与 `https:` 的宽放是为兼容 Next 的动态渲染与 GitHub 头像，属**已知的强度折衷**。
站点未使用 nonce，故也没有启用基于 nonce 的严格 CSP。

---

## 六、密钥与配置

| 项 | 现状 |
|---|---|
| `.env` | **已从版本库移除**（`git ls-files .env` 为空），本地文件保留；`.dockerignore` 排除了 `.env`/`.env.*` |
| ⚠️ `AUTH_SECRET` / `AUTH_GITHUB_SECRET` | 已进入早期 git 历史 → **视为泄露，必须轮换**（`openssl rand -base64 32`），并考虑用 `git filter-repo` 清理历史。**该项至今未完成** |
| `docker-compose.yml` | `AUTH_SECRET=${AUTH_SECRET:-change-me-to-random-string}`：不设也能启动，但会用一个公开的默认值签名会话 |
| 种子口令 | `admin@solution.local / admin123`、`user1234`（可用 `SEED_ADMIN_PASSWORD`/`SEED_USER_PASSWORD` 覆盖）；生产必须在 seed 前覆盖 |
| 上传持久化 | `uploads-data` 命名卷挂到 `/app/public/uploads`（否则容器重建丢头像） |

---

## 七、依赖漏洞状态

| 指标 | 修复前（官方 registry 复核） | 现在 |
|---|---|---|
| critical | 3 | **0** |
| high | 68 | 7 |
| moderate | 24 | **0** |
| low | 2 | **0** |

- 剩余 7 条是**同一根因** `braces` 的深度嵌套 DoS：上游最新版即受影响版本（无补丁），且只存在于
  Tailwind/ESLint 工具链，**不在 standalone 生产产物里**，输入也不由终端用户控制 → 按「已接受风险」登记并写明监控条件。
- 已做的升级：Tiptap 2→3、dompurify 3.4.16、next-auth beta.32、**Next 14.2.35 → 15.5.27 + React 19**、
  `postcss-selector-parser` 钉 7.1.6，以及一批 `overrides`。
- 细节、逐条公告与验证证据见 [dependency-audit-2026-10.md](./dependency-audit-2026-10.md)。

---

## 八、待处理清单（按优先级）

| 优先级 | 事项 |
|---|---|
| 高 | **轮换 `AUTH_SECRET` 与 GitHub OAuth Secret**（旧值在 git 历史中；见第六节） |
| ~~高~~ | ~~把前台内容写接口的 `session.user.role` 换成回库判定~~ → 已于 2026-10-07 修复（5 个内容写接口改用 `getSessionUser()` + `isActiveAdmin()`） |
| 中 | 引入 `@auth/prisma-adapter`（或邮箱校验后的账号关联），让 GitHub OAuth 用户真正进入 `User` 表 |
| 中 | 限流换成 Redis/共享存储；否则多实例部署下额度形同虚设。**直连部署（不设 `TRUST_PROXY`）下，同一 suffix 的额度是全站共享的**：一个客户端可以打满注册/评论额度，取舍见第四节 |
| 中 | 反向代理部署记得设 `TRUST_PROXY=1`，否则所有请求都退化成共享桶（额度仍生效，但失去按 IP 的区分度） |
| 中 | 收紧 `sanitizeHtml` 的 `style` 属性；评估给业务接口加 CSRF token |
| 中 | 建立 `prisma/migrations`，并把部署流程从 `db push` 切到 `migrate deploy` |
| 低 | 生产环境不要直接发布 app 容器的 3000 端口（当前 compose 直接映射，可绕过 Nginx/HTTPS） |
| 低 | 给 Docker 加 healthcheck；`AUTH_SECRET` 缺失时让容器**启动即失败**而不是用默认值 |
| 低 | CSP 引入 nonce 或收敛 `script-src` 的 `https:` |
| 低 | `/api/views` 无鉴权且可无限打点（浏览量是展示性数据，风险有限） |
