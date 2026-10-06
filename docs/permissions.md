# 文件权限与部署目录

裸机（非 Docker）Linux 部署时的**文件权限基线**、被破坏的常见原因，以及一键修复与校验方法。

本文的命令在 `/srv/www/Solution`（Fedora + xfs，无 sudo 的普通用户）上实测通过，数字均来自实机复核。

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
| 文件权限 | 242 个 `777` | 250 个 `644` |
| 目录权限 | 107 个 `777` | 109 个 `755` |
| `.env` | `755` | **`600`** |
| 属主 | 349 个 `main:root` + 11 个 `main:main` | 360 个 **`main:main`** |

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

## 八、相关文档

- [operations.md](./operations.md) — 环境变量、数据库、Docker 实现侧事实、发布检查清单
- [security.md](./security.md) — 密钥现状（`AUTH_SECRET` 轮换未完成）、CSP、认证分层
- [dev-environment.md](./dev-environment.md) — 构建冲突、编码损坏、沙箱 ACL 等开发期陷阱
- `DEPLOY.md`（仓库根目录） — 面向部署者的完整手册
