# 裸机部署：权限、网络与数据文件

非 Docker 形态（直接 `npm run dev` 或 `node .next/standalone/server.js`）在 Linux 上落地时要处理的三件事：
**文件权限基线**、**防火墙放行**、**数据库文件的替换与备份**。

本文命令在 `/srv/www/Solution`（Fedora 44 Server + xfs，普通用户 `main`，`sudo` 需密码）上实测通过，数字均来自实机复核。

> Docker 形态**不需要**关心这些：镜像内的属主与权限由 `Dockerfile` 和命名卷挂载点决定
> （`RUN mkdir -p /app/data /app/public/uploads/avatars && chown -R nextjs:nodejs …`），
> 见 [operations.md](./operations.md) 第五节。本文只针对「直接跑 `npm run dev` / `node .next/standalone/server.js`」的裸机形态。

---

## 一、权限基线

| 路径 | 权限 | 属主 | 理由 |
|---|---|---|---|
| 工作区内**目录**（排除下三项） | `755` | `main:main` | 可遍历即够，不需要组/其他人写 |
| 工作区内**文件**（排除下三项） | `644` | `main:main` | 见下方判定规则 |
| `.env` | `600` | `main:main` | 含 `AUTH_SECRET`、GitHub OAuth secret |
| `prisma/` 目录与 `prisma/dev.db` | `755` / `644` | `main:main` | SQLite 用 `journal_mode: delete`，需要在**同目录**创建 `dev.db-journal`；目录不可写则写入失败 |
| `public/uploads/` 与 `public/uploads/avatars/` | `755` | `main:main` | `/api/upload` 的落盘目录，必须对运行用户可写 |
| `docker-entrypoint.sh` | `644` | `main:main` | `Dockerfile` 用 `ENTRYPOINT ["sh", "./docker-entrypoint.sh"]` 调用，**不需要可执行位** |
| `node_modules/`、`.next/`、`.git/` | **不动** | — | 前两者是安装/构建产物（含需要 `+x` 的 native 二进制），后者由 git 自行管理 |

**判定规则：工作区的权限位应当与 git 索引一致。** 用索引核对，不要凭感觉：

```bash
cd /srv/www/Solution
git ls-files -s | awk '$1=="100755"{print $4}'   # 需要可执行位的文件
```

本仓库该命令输出为**空**（0 个 `100755`），所以「所有文件 `644`」不是拍脑袋，而是与 git 声明一致。
仓库里唯一的 shell 脚本 `docker-entrypoint.sh` 由 `sh` 显式调用，也不依赖可执行位。

---

## 二、被破坏的典型症状

从 Windows 侧同步/拷贝代码到 Linux（WinSCP、SFTP、共享目录、解压 zip）时，**Unix 权限位不会被保留**，
通常按 `umask` 或全开权限落盘。实测现场（Fedora + xfs，umask 0022）：

```
$ git status --porcelain | wc -l
242
$ git diff --numstat | awk '{a+=$1;d+=$2} END{print a+0"/"d+0}'
2/2                     # 真实内容改动只有 2 行
$ git diff --summary | grep -c 'mode change'
242                     # 其余 240 条全是 old mode 100644 -> new mode 100755
$ find . -path ./.git -prune -o -path ./node_modules -prune -o -path ./.next -prune -o -printf '%M\n' | sort | uniq -c
    242 -rwxrwxrwx      # 文件全 777
    107 drwxrwxrwx      # 目录全 777
```

危害不只是「看着烦」：

1. **`git status` 失去参考价值**——242 条噪音里只有 1 条是真的，很容易漏掉真实改动，也容易误提交一堆 mode 变更。
2. **权限语义错误**——`777` 意味着同机任何用户都能改写源码与数据库；`.env` 变成 `755` 更是把密钥摊开。
3. **排查被带偏**——`bash: $'\r': 未找到命令` 之类的问题会让人怀疑换行符，实际是同步工具同时破坏了行尾与权限位。

> 换行符是**另一件事**，别混为一谈：本仓库的 `.gitattributes` 已把 `*.sh` / `Dockerfile` / `*.py` / `*.prisma`
> 钉成 `eol=lf`，所以仓库内容本身是 LF；上面那条 `$'\r'` 报错通常来自**本地临时脚本**没转 LF 就被管道送进远端 `bash`。

---

## 三、一键修复

```bash
cd /srv/www/Solution

# 1) 让 git 不再把权限位差异算作改动（同步部署的常规配置，推荐保留）
git config core.fileMode false

# 2) 目录 -> 755
find . \( -path ./.git -o -path ./node_modules -o -path ./.next \) -prune -o -type d -print0 \
  | xargs -0 -r chmod 755

# 3) 文件 -> 644
find . \( -path ./.git -o -path ./node_modules -o -path ./.next \) -prune -o -type f -print0 \
  | xargs -0 -r chmod 644

# 4) 属主组归一（无 sudo 时只能改到自己所属的组）
find . \( -path ./.git -o -path ./node_modules -o -path ./.next \) -prune -o -print0 \
  | xargs -0 -r chgrp main

# 5) 密钥文件（必须在第 3 步之后，否则会被覆盖回 644）
chmod 600 .env

# 6) 上传目录确认可写
mkdir -p public/uploads/avatars
chmod 755 public/uploads public/uploads/avatars
```

### ⚠️ 两个必须知道的坑

**坑 1：不要把 `-prune` 表达式放进 shell 变量。**

```bash
PRUNE='\( -path ./.git -o -path ./node_modules \) -prune'
find . $PRUNE -o -type f -print0 | xargs -0 chmod 644     # ✗ 不生效
```

变量展开后 `\(` 不再被 shell 转义，`find` 收到字面量 `\)` 直接报
`find: 路径必须在表达式之前："\)"`。更糟的是 **`xargs -r` 会静默吞掉空输入并返回 0**，
于是整条链路「看起来成功、实际什么都没做」。必须把表达式内联写进 `find`。

**坑 2：第 5 步不能省。**

第 3 步会把 `.env` 一并刷成 `644`。`644` 对单用户机器影响有限，但密钥文件没有理由让同组/其他用户可读。

---

## 四、校验

```bash
cd /srv/www/Solution

# 权限分布：应当只剩 644（文件）/ 755（目录）/ 600（.env）
find . \( -path ./.git -o -path ./node_modules -o -path ./.next \) -prune -o -printf '%M\n' \
  | sort | uniq -c | sort -rn

# 属主分布：应用以哪个用户跑，就应当全部属于它
find . \( -path ./.git -o -path ./node_modules -o -path ./.next \) -prune -o -printf '%u:%g\n' \
  | sort | uniq -c | sort -rn

# git 是否干净（mode 噪音应为 0）
git status --porcelain | wc -l
git diff --summary | grep -c 'mode change'      # 期望 0

# 上传目录可写性（应用以 main 运行时的等价自测）
touch public/uploads/avatars/.perm-test && rm -f public/uploads/avatars/.perm-test && echo writable

# SQLite 读写（顺带验证目录可写、journal 可建）
node --env-file=.env -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  await p.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS _perm_probe (x INTEGER)");
  await p.$executeRawUnsafe("DROP TABLE _perm_probe");
  console.log("sqlite rw ok, users =", await p.user.count());
  await p.$disconnect();
})();'
```

修复前后实测对照：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| `git status --porcelain` 条目 | 242 | **1**（仅 `M package.json`，来自 `npm install` 更新 `allowScripts` 版本键） |
| `git diff --summary` 里的 mode change | 242 | **0** |
| 文件权限 | 242 个 `777` | 248 个 `644` |
| 目录权限 | 107 个 `777` | 109 个 `755` |
| `.env` | `755` | **`600`** |
| 属主 | 349 个 `main:root` + 11 个 `main:main` | 358 个 **`main:main`** |

> 表里的「修复后」是**最终态**：最初 chmod 后是 250 个文件 / 360 个属主，随后把两件不该待在仓库里的产物
> （开发服务日志 `dev.log`、空库备份 `dev.db.bak-*`）移到了仓库外，计数随之变成 248 / 358。

---

## 五、`.env` 的约定

- **只有 `.env` 会被加载。** Prisma CLI 依次查 `./.env`、`./prisma/.env`（[官方文档](https://www.prisma.io/docs/orm/more/dev-environment/environment-variables)）；
  Next.js 另外还会读 `.env.local`、`.env.development` 等。**Prisma CLI 不读 `.env.local`**——
  只建 `.env.local` 会出现「Next 能连库、`npx prisma db push` 却报 P1012 Environment variable not found: DATABASE_URL」的不对称现象。
- `.env` 不进版本库（`.gitignore` 与 `.dockerignore` 均已排除），`git ls-files` 只有 `.env.example`。
  **每次换机器、重新 clone、重建目录后都必须手动补一次**：

  ```bash
  cp .env.example .env
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env
  chmod 600 .env
  ```

- `DATABASE_URL` 用相对路径时，**基准是 `schema.prisma` 所在目录**而不是仓库根目录：
  `file:./dev.db` → `prisma/dev.db`。写成 `file:./prisma/dev.db` 会解析到 `prisma/prisma/dev.db`
  （[operations.md](./operations.md) 第五节差异 4 记录过同一个坑）。
- 属主与权限：`main:main` + `600`。应用进程与 `prisma` CLI 都以 `main` 运行，因此不牺牲可用性。

### `.env` 缺失时长什么样（两个报错，一个根因）

`.env` 从来不在版本库里，所以每次换机器 / 重新 clone / 重建目录后都会缺。表现是**两个看起来无关的报错**：

```text
[auth][error] MissingSecret: Please define a `secret`.
    at assertConfig (@auth/core/lib/utils/assert.js)
[PrismaClientInitializationError] error: Environment variable not found: DATABASE_URL.
  -->  schema.prisma:8  url = env("DATABASE_URL")
```

两者都只是「变量没读到」，**不是依赖版本问题**——`@auth/core` 的 `assertConfig` 从 0.41.2 到 0.41.3
一直是无条件硬失败（`if (!options.secret?.length) return new MissingSecret(...)`），没有开发环境豁免。
`prisma db push` 同样会报 P1012，因为它也读 `.env`。

**此时鉴权是 fail-closed 的**，不会把匿名用户放行：`@auth/core` 对 session 请求返回 500，
而 `next-auth` 的 `parseSessionResponse` 把任何非 OK 响应当成「无会话」返回 `null`，
于是 `!!req.auth` 恒为 false（这正是 beta.32 修的 GHSA-8fpg-xm3f-6cx3）。
代价是**登录功能完全不可用**——登录成功后 middleware 仍认为你未登录，受保护页面会一直弹回 `/login`。

诊断与处置：

```bash
cd /srv/www/Solution
ls -la .env prisma/.env 2>&1          # 先确认文件在不在（Prisma 只认这两个名字）
cp -n .env.example .env               # 不在就从模板建
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env
sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=\"http://<主机地址>:3000\"|" .env
chmod 600 .env
grep -vE '^\s*(#|$)' .env             # 确认 DATABASE_URL 没被注释、拼写正确
npx prisma db push                    # 建表；成功即说明 .env 已被正确加载
```

---

## 六、数据文件与备份

裸机形态下有两个**可变**目录，二者都不进版本库，权限错了会直接表现为运行期故障：

| 路径 | 作用 | 权限错时的症状 |
|---|---|---|
| `prisma/dev.db`（+ `-journal`） | SQLite 数据库 | `unable to open database file`；或写入时 `SQLITE_READONLY` |
| `public/uploads/` | 上传的头像 | 上传接口 500；头像 URL 404 |

备份建议放在**仓库之外**，避免污染 `git status`（`prisma/dev.db.bak-*` 这类名字不在 `.gitignore` 的匹配范围内）：

```bash
mkdir -p ~/db-backups
cp prisma/dev.db ~/db-backups/dev.db.$(date +%Y%m%d-%H%M%S)
```

同理，长时间挂着的开发服务日志也不要落在仓库根：重定向到仓库外即可（`setsid nohup npm run dev > /tmp/solution-dev.log 2>&1 &`）。

---

## 七、不要动的东西

| 路径 | 原因 |
|---|---|
| `node_modules/` | `npm ci` 落的权限是对的；里面有 `sharp`、`@swc/core`、`esbuild` 等**原生二进制**依赖可执行位，批量 `644` 会把它们弄坏 |
| `.next/` | 构建/dev 产物，Next 自己管理；且体量大（实测 74 MB） |
| `.git/` | git 自行管理；在受限沙箱里对它的写入可能被显式拒绝，见 [dev-environment.md](./dev-environment.md) 第 8.2 节 |
| `output/` | 归档的后台复核截图，属于仓库内容，跟着 `644/755` 一起归一即可 |

---

## 八、网络访问（firewalld）

Fedora Server 默认启用 firewalld，活动 zone 是 `FedoraServer`。**进程监听在 `*:3000` 不等于外部能访问**，
必须确认防火墙放行。

### 先分清「进程没起」和「端口没放」

```bash
ss -ltnp | grep ':3000'                 # 机器内部：进程是否在监听
firewall-cmd --list-ports               # 当前 zone 放了哪些端口
sudo firewall-cmd --list-services
```

外部验证必须在**另一台机器**上做——`curl 127.0.0.1:3000` 只证明进程活着，不证明放行：

```powershell
Test-NetConnection -ComputerName <host> -Port 3000       # TCP 可达性
Invoke-WebRequest http://<host>:3000/ -UseBasicParsing   # 再验 HTTP
```

### 放行

```bash
sudo firewall-cmd --permanent --zone=FedoraServer --add-port=3000/tcp
sudo firewall-cmd --reload
```

`--permanent` 写配置、`--reload` 生效，**两条都要**，否则重启后失效。验收时确认 runtime 与 permanent 都含 `3000/tcp`。

> `firewall-cmd --list-*` 需要 root，非 root 会报 `Authorization failed. Make sure polkit agent is running…`，
> 这是权限问题不是防火墙没配。

### 只放开局域网（推荐）

```bash
sudo firewall-cmd --permanent --zone=FedoraServer --remove-port=3000/tcp
sudo firewall-cmd --permanent --zone=FedoraServer \
  --add-rich-rule='rule family="ipv4" source address="192.168.50.0/24" port port="3000" protocol="tcp" accept'
sudo firewall-cmd --reload
```

### 回滚

```bash
sudo firewall-cmd --permanent --zone=FedoraServer --remove-port=3000/tcp && sudo firewall-cmd --reload
```

### SELinux

Fedora 默认 `Enforcing`。Node 以普通用户进程直接监听，**不涉及 `http_port_t` 标签，不需要** `semanage port -a`；
实测放行后外部即可访问。只有经 httpd/nginx 反代非标准端口时才需要打标签。

### ⚠️ 别把开发服务器长期对外

`next dev` 没有生产优化，会暴露 React 错误浮层与源码映射。把端口开放给他人访问前，先换成生产产物：

```bash
npm run build && node .next/standalone/server.js
```

---

## 九、在服务器上更换 SQLite 数据库

SQLite 单文件 + **无 migrations**，所以把别处的 `dev.db` 搬到线上不是 `cp` 一下就完事——它的表结构可能
已经落后于 `schema.prisma`。完整流程如下，每一步都可独立回退。

### 1. 先比对结构漂移（只读）

```bash
npx prisma migrate diff \
  --from-url "file:./<待迁移的库>.db" \
  --to-schema-datamodel prisma/schema.prisma --script
```

输出就是「补齐到当前 schema 所需的 SQL」。**先看有没有 `DROP` / `DELETE` / `RENAME`**：纯增量的
（`ALTER TABLE … ADD COLUMN`、`CREATE TABLE`）可以安全套用；一旦出现 DROP，必须先评估数据损失。

一次真实迁移的差异面（旧桌面库 → 当前 schema），全部是增量：

```sql
ALTER TABLE "User" ADD COLUMN "banReason" TEXT;
ALTER TABLE "User" ADD COLUMN "bannedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
CREATE TABLE "AuditLog" ( ... );
-- 另有 7 条 CREATE INDEX
```

### 2. 在副本上套迁移，不要动原件

```bash
cp <原件>.db .tmp-migrated.db
# 用任意 SQLite 客户端执行第 1 步的全部 SQL（sqlite3 CLI 或 python3 的 sqlite3 模块均可）
```

### 3. 三方校验

```sql
PRAGMA integrity_check;      -- 期望 ok
PRAGMA foreign_key_check;    -- 期望无输出
```

再逐表逐列与当前 schema 比对（最省事的参照物是本地一份 `db push` 出来的空库），最后让 Prisma 自证：

```bash
npx prisma migrate diff --from-url "file:./.tmp-migrated.db" \
  --to-schema-datamodel prisma/schema.prisma --script     # 期望 "This is an empty migration."
```

### 4. 备份线上库、停服务

```bash
cd /srv/www/Solution
mkdir -p ~/db-backups
cp -p prisma/dev.db ~/db-backups/dev.db.bak-$(date +%Y%m%d-%H%M%S)
pkill -f 'next dev'          # 文件被占用时不要直接覆盖
```

### 5. 上传 + 原子替换

```bash
scp .tmp-migrated.db main@<host>:/srv/www/Solution/prisma/dev.db.new
```

远端：

```bash
cd /srv/www/Solution
mv -f prisma/dev.db.new prisma/dev.db
chmod 644 prisma/dev.db
```

先传成 `.new` 再 `mv`，替换是原子的，不会出现半个文件。

### 6. 自证 + 起服务

```bash
npx prisma db push      # 期望 "The database is already in sync with the Prisma schema."
# 抽查关键表行数与管理员名单，再起服务：
setsid nohup npm run dev > /tmp/solution-dev.log 2>&1 < /dev/null &
```

### ⚠️ 别忘了 `public/uploads/`

**上传的文件不在数据库里**，库里只有 `/uploads/avatars/<uuid>.png` 这样的引用。只搬库会出现
「数据都在、头像全 404」。换库前把引用全抽出来交叉核对：

```bash
python3 - <<'PY'
import sqlite3, re, os
con = sqlite3.connect("file:prisma/dev.db?mode=ro", uri=True)
refs = set()
targets = [("User", ["image"]), ("SiteConfig", ["logo"]),
           ("Article", ["content", "coverImage"]), ("Question", ["content"]),
           ("Answer", ["content"]), ("Software", ["content", "icon", "screenshot"]),
           ("Comment", ["content"])]
for table, cols in targets:
    have = {r[1] for r in con.execute('PRAGMA table_info("%s")' % table)}
    cols = [c for c in cols if c in have]
    if not cols:
        continue
    sel = ", ".join('"%s"' % c for c in cols)
    for row in con.execute('SELECT %s FROM "%s"' % (sel, table)):
        for v in row:
            if isinstance(v, str):
                refs |= set(re.findall(r"/uploads/[A-Za-z0-9_\-./]+", v))
for r in sorted(refs):
    print(("OK  " if os.path.exists("public" + r) else "MISS"), r)
PY
```

把 `MISS` 的文件补进 `public/uploads/`，文件 `644`、目录 `755`。

### 回滚

备份在 `~/db-backups/`（**仓库外**，避免污染 `git status`）。回滚即：停服 → `cp` 回去 → 起服。

---

## 十、相关文档

- [operations.md](./operations.md) — 环境变量、数据库、Docker 实现侧事实、发布检查清单
- [security.md](./security.md) — 密钥现状（`AUTH_SECRET` 轮换未完成）、CSP、认证分层
- [dev-environment.md](./dev-environment.md) — 构建冲突、编码损坏、沙箱 ACL 等开发期陷阱
- `DEPLOY.md`（仓库根目录） — 面向部署者的完整手册
