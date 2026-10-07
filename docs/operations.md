# 运行与运维

本地开发、环境变量、数据库、构建自检与发布流程。部署手册另见仓库根目录的 [DEPLOY.md](../DEPLOY.md)
（环境要求、Nginx/SSL、备份、更新、排障），**本文补充实现侧事实与 DEPLOY.md 尚未覆盖的差异**。

---

## 一、环境变量

| 变量 | 必填 | 默认 | 作用 / 说明 |
|---|---|---|---|
| `DATABASE_URL` | 是 | `.env.example` 为 `file:./dev.db` | Prisma datasource。**容器里被 compose 钉死为 `file:/app/data/dev.db`** |
| `AUTH_SECRET` | 是 | compose 里默认 `change-me-to-random-string` | JWT 签名；不设也能启动，但极不安全 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | 否（不用 GitHub 登录可不填） | 空 | GitHub OAuth App 凭据 |
| `NEXT_PUBLIC_SITE_URL` | 建议 | `http://localhost:3000` | `metadataBase`、sitemap、robots、RSS、JSON-LD 的绝对地址 |
| `CRAWLER_INTERVAL_HOURS` | 否 | 代码里 `24`，但**会被夹到 1–23** | 定时采集间隔；写 24 实际得到 23h（见第五节差异 1） |
| `PYTHON_BIN` | 否 | `python`(Windows) / `python3`(其它) | 采集子进程解释器；容器里默认 `python3` |
| `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` | 生产必填 | `admin123` / `user1234` | `npm run db:seed` 的密码；未覆盖时 seed 会打印警告 |
| `CHECK_BASE` | 否 | `http://127.0.0.1:3103` | `npm run i18n:check:runtime` 的目标地址 |
| `NODE_ENV` / `NEXT_RUNTIME` | Next 自带 | — | 分别控制 Prisma 单例挂载、CSP `unsafe-eval`、以及定时采集只在 `production` 注册 |

`.env.example` 是**唯一**进版本库的环境模板；`.env` 已被 `.gitignore` 与 `.dockerignore` 忽略。

---

## 二、本地起步

```bash
npm ci                    # 安装依赖（postinstall 会跑 prisma generate）
cp .env.example .env      # 填 AUTH_SECRET / DATABASE_URL / 可选 GitHub OAuth
npm run db:push           # 同步 schema 到 SQLite
npm run db:seed           # 可选：种子数据（会创建 admin@solution.local，默认口令 admin123）
npm run dev               # http://localhost:3000
```

爬虫（Python 3.12+，从**仓库根目录**运行）：

```bash
pip install -r crawler/requirements.txt
python -m crawler.main --list
```

> 环境陷阱（`.next` 并发构建、PowerShell 中文编码、沙箱 ACL / `spawn EPERM`、`next lint` 在沙箱内无法运行）
> 统一记录在 [dev-environment.md](./dev-environment.md)，**动手前先读**。

---

## 三、数据库

| 操作 | 命令 / 方式 |
|---|---|
| 同步 schema | `npm run db:push`（当前**没有 migrations**，只有 `db push`） |
| 生成 Client 类型 | `npm run db:generate`（`postinstall` 已包含） |
| 种子数据 | `npm run db:seed`（幂等；密码可覆盖） |
| 图形化查看 | `npm run db:studio` |
| 备份（本机） | 直接复制 `prisma/dev.db` |
| 备份（容器） | `docker compose exec app cp /app/data/dev.db /app/data/dev.db.$(date +%F)`（DEPLOY.md 有 crontab 示例） |
| 重置（容器） | 删掉数据卷里的 `dev.db` 后重启：启动脚本会从镜像快照重新物化 |

- SQLite 单文件，**无 migrations**：改 schema 后旧库不会自动升级，生产需先备份再 `db push`（或手工迁移）。
- 种子账号：`admin@solution.local`（seed 创建，默认 `admin123`）、普通用户（`user1234`）。
  本机开发库里 `admin@solution.local` 当前是 **USER**，唯一管理员是 `860256007@qq.com`——请在后台确认管理员名单。

---

## 四、构建与自检

```bash
npx tsc --noEmit        # 类型检查（增量缓存写到 .next/cache/tsconfig.tsbuildinfo）
npx next lint           # ESLint（Next 15 已标记 deprecated，Next 16 移除）
npm run i18n:check      # 词条对齐 + 无硬编码中文（秒级）
npm run build           # 生产构建；⚠️ 必须先停掉 npm run dev
npm run i18n:check:runtime   # 可选：对 next start -p 3103 做运行期语言检查
```

- `output: "standalone"`：本地想跑生产产物用 `node .next/standalone/server.js`；
  `next start` 会提示不适用于 standalone。
- **沙箱限制**：在 DSH 沙箱内 `npx next lint` 会因 SWC 原生模块缓存目录（`%LOCALAPPDATA%\swc`）被拒绝访问而崩溃，
  `SWC_NATIVE_BINDING_CACHE` 指到工作区也无效。替代做法是直接用 ESLint CLI：

  ```bash
  npx eslint src --ext .ts,.tsx     # 与 next lint 同一套规则（next/core-web-vitals）
  ```

  详见 [dev-environment.md](./dev-environment.md) 第 8 节。
- `npm run build` 需要可用的 `DATABASE_URL`（`sitemap.ts` 是 `force-dynamic` 但构建期仍可能触库），
  Docker 构建期用 `file:/app/prisma/build.db` 单独建快照。

---

## 五、部署形态（实现侧事实）

> 本节只讲 **Docker** 形态。**裸机 Linux 部署**（直接 `npm run dev` 或 `node .next/standalone/server.js`）
> 的文件权限基线、`.env` 放置规则、以及「从 Windows 同步导致权限位被破坏」的修复方法，
> 见 [permissions.md](./permissions.md)。

`Dockerfile` 三阶段：

| 阶段 | 镜像 | 关键动作 |
|---|---|---|
| `builder` | `node:20-alpine` | `npm ci` → `prisma generate` → `db push`（产出 `prisma/build.db` 快照）→ `npm run build` |
| `crawler-deps` | `python:3.12-alpine` | `pip install -r crawler/requirements.txt` 到 `/usr/local/lib/python3.12/site-packages` |
| `runner` | `node:20-alpine` | 装 `python3`/`py3-pip`；`PYTHONPATH` 指向上面那份 site-packages；`USER nextjs(1001)`；`ENTRYPOINT docker-entrypoint.sh` + `CMD node server.js` |

`docker-compose.yml`：

- `app`：`3000:3000` 直接对宿主机发布；卷 `app-data:/app/data`（真实库）、`uploads-data:/app/public/uploads`（头像）、
  **bind `./prisma:/app/prisma`**（会遮蔽镜像里的 `/app/prisma`）；`restart: unless-stopped`；**没有 healthcheck**。
- `nginx`：`profiles: [production]`，挂 `./nginx.conf`、`./certbot/*`（**仓库里没有这两个路径**，需按 DEPLOY.md 自建）。
- `docker-entrypoint.sh`：**只在目标库文件不存在时**从 `/app/prisma-template.db` 复制一份，然后 `exec "$@"`；
  不跑 migrate、不跑 `db push`（standalone 产物没有 Prisma CLI）。

### 与 DEPLOY.md 的差异（建议逐条修正文档）

| # | 差异 | 证据 |
|---|---|---|
| 1 | **采集间隔自相矛盾**：DEPLOY 写「1–23」，`.env.example` 与 compose 默认 `24`，实现会把 >23 夹成 23 | `DEPLOY.md:34`、`.env.example:6`、`docker-compose.yml:17`、`src/lib/crawler-scheduler.ts:19-22` |
| 2 | **`PYTHON_BIN` 默认值三处说法不同**：`.env.example` 注释说 `python`，compose 注释说 Alpine 没有裸 `python` 故默认 `python3`，代码按平台选 | `.env.example:7`、`docker-compose.yml:18-19`、`src/lib/crawler-ingest.ts` |
| 3 | **`DATABASE_URL` 被文档列为可配置，实际被 compose 钉死**；若真把 `.env` 的值传进容器，`entrypoint` 会在卷外的 `/app/dev.db` 建库（重建即丢） | `DEPLOY.md:29`、`docker-compose.yml:12`、`docker-entrypoint.sh:8-14` |
| 4 | **宿主 seed 命令无效**：`DATABASE_URL="file:./prisma/dev.db"` 的相对路径以 `schema.prisma` 所在目录为基准（会解析成 `prisma/prisma/dev.db`），且碰不到容器里的库 | `DEPLOY.md:52-57` |
| 5 | `production` profile 依赖的 `nginx.conf` 与 `certbot/` 在仓库中不存在 | `docker-compose.yml:33-36`，`Test-Path nginx.conf` = False |
| 6 | 文档未提 `./prisma` bind mount 及其遮蔽效应 | `docker-compose.yml:23` |
| 7 | 文档未提 app 容器 3000 端口直接对外（可绕过 Nginx/HTTPS） | `docker-compose.yml:10` |
| 8 | 环境变量表漏了 `SEED_USER_PASSWORD` | `DEPLOY.md:27-36`、`.env.example:11` |
| 9 | 文档要求 Compose v2，而 compose 文件仍带过时的顶层 `version: "3.9"` | `DEPLOY.md:7`、`docker-compose.yml:1` |
| 10 | 「默认管理员账号」一节与当前开发库不符（`admin@solution.local` 现为 USER） | `DEPLOY.md:202-209` vs `prisma/dev.db` |

> 一致的部分（可放心引用）：`.env` 未被跟踪、`.dockerignore` 排除 `.env`；库在 `app-data/dev.db`；更新重建会保留既有库；
> 删库重启可从镜像快照重建；运行镜像无 `tsx`/Prisma CLI；采集内容进入审核队列（`status:"draft"`）。

### 运维注意

- **`PYTHONPATH` 硬编码 python3.12**：`node:20-alpine` 自带的 `python3` 版本随 Alpine 漂移，一旦不是 3.12，
  `lxml` 等扩展会失配 → 容器内爬虫 `ModuleNotFoundError`。升级基础镜像时要同步改这里。
- **无 healthcheck**：`nginx` 的 `depends_on` 不等待 app 就绪。
- **数据库迁移**：容器内无法执行 Prisma CLI，schema 变更必须重建镜像 + 处理数据卷。
- **上传体积与代理**：附件上限是**单文件 64 MB（视频）**，其余 8–24 MB（矩阵见 [security.md](./security.md)）。
  `app` 容器的 3000 端口是直接发布的，所以默认没有代理限制；一旦前面挂了 Nginx/网关，必须把
  `client_max_body_size`（或等价配置）调到 **≥ 64 MB**，否则视频上传会在代理处先被 413 掉。
  上传落盘在 `uploads-data` 卷（`/app/public/uploads`），与 `app-data`（数据库）分开备份。
- 定时采集只在 `NODE_ENV=production` 注册；`docker` 运行即生产，故容器内会启动（启动日志有 `[crawler] scheduled …`）。

---

## 六、发布检查清单

1. `git status` 确认改动范围，不含 `*.log`、`.tmp-*`、`.playwright-cli/` 等临时产物。
2. 停掉 `npm run dev`，然后依次跑：`npx tsc --noEmit` → `npx next lint`（或 `npx eslint src --ext .ts,.tsx`）→
   `npm run i18n:check` → `npm run build`。
3. 需要时再跑 `npx next start -p 3103` + `npm run i18n:check:runtime`。
4. 备份数据库；若含 schema 变更，确认新增列可空或带默认值。
5. 发布后抽查（`dependency-audit-2026-10.md` 第六节的冒烟清单可直接复用）：
   `/`、`/en`、`/solutions`、`/questions`、`/software`、`/tags/<slug>`、`/search?q=…`、
   某个详情页、`/admin`（未登录应回落登录）、`/api/rss`、`/sitemap.xml`、旧链接 `/docs`（应 308 到 `/solutions`）。
6. 观察服务端日志有无 `error` / `unhandledRejection`；容器里确认 `[crawler] scheduled …` 已打印。
7. **仍待人工完成**：轮换 `AUTH_SECRET` 与 GitHub OAuth Secret（旧值在 git 历史中），见 [security.md](./security.md)。
