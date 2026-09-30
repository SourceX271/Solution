# Solution 网站部署文档

## 环境要求

- 服务器操作系统: Linux (Ubuntu 20.04+ / Debian 11+)
- Docker 24.0+
- Docker Compose v2
- 域名 (可选，用于 SSL)

## 快速部署

### 1. 克隆项目并配置环境变量

```bash
git clone <your-repo-url> solution
cd solution

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改必要配置
nano .env
```

**重要环境变量说明：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:/app/data/dev.db` |
| `AUTH_SECRET` | 认证密钥 (必须修改) | 运行 `openssl rand -base64 32` 生成 |
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID | 在 GitHub Developer Settings 获取 |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Secret | 同上 |
| `NEXT_PUBLIC_SITE_URL` | 网站公开 URL | `https://yourdomain.com` |
| `CRAWLER_INTERVAL_HOURS` | 爬虫运行间隔 (小时，1–23) | `24` |
| `PYTHON_BIN` | 爬虫使用的 Python 解释器 (可选) | `python3` |
| `SEED_ADMIN_PASSWORD` | 种子脚本创建的管理员密码 (可选) | 随机强密码 |

> `.env` 已从版本库中移除且被 `.dockerignore` 忽略。**部署前请轮换 `AUTH_SECRET`、
> `AUTH_GITHUB_SECRET` 等已泄露到历史的密钥**，并通过 `docker compose` 的环境变量或
> `--env-file` 传入，不要写回仓库。

### 2. 构建并启动

```bash
# 构建 Docker 镜像并启动（首次启动会自动用镜像内的 schema 快照初始化
# /app/data/dev.db，无需在容器内执行 prisma 命令——standalone 产物不含 Prisma CLI）
docker compose up -d --build
```

网站将运行在 `http://localhost:3000`。

如需导入演示数据，请在**本机**（非容器）执行，因为运行镜像不包含 `tsx`/Prisma CLI：

```bash
DATABASE_URL="file:./prisma/dev.db" npm run db:seed
# 或在容器内初始化后把 dev.db 复制进 app-data 卷
```

### 3. 配置 Nginx 反向代理 (生产环境)

创建 `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        location / {
            proxy_pass http://app:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

使用 Nginx 配置启动:

```bash
docker compose --profile production up -d
```

### 4. 配置 SSL 证书 (Let's Encrypt)

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书 (确保域名已解析到服务器)
sudo certbot certonly --webroot -w ./certbot/www -d yourdomain.com

# 续期证书
sudo certbot renew --dry-run
```

## 爬虫配置

爬虫通过 `node-cron` 定时运行。在管理后台 `/admin/crawler` 可以：

- 查看和管理爬虫数据源
- 手动触发爬取任务
- 查看爬取日志
- 配置爬取间隔

所有爬取的内容会进入审核队列，在后台审核通过后才会公开展示。

## OAuth 配置指南

### GitHub OAuth

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息:
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `https://yourdomain.com/api/auth/callback/github`
4. 获取 Client ID 和 Client Secret，填入 `.env`

## 数据库备份

SQLite 数据库文件位于 `app-data/dev.db`。备份方法：

```bash
# 手动备份
docker compose exec app cp /app/data/dev.db /app/data/dev.db.backup

# 定时备份 (crontab)
0 3 * * * cd /path/to/solution && docker compose exec -T app cp /app/data/dev.db /app/data/dev.db.$(date +\%Y\%m\%d)
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并重启（启动脚本会保留已有数据库；schema 变更需按下文重置或自行迁移）
docker compose up -d --build
```

## 故障排查

### 查看日志
```bash
docker compose logs -f app
```

### 重启服务
```bash
docker compose restart app
```

### 进入容器调试
```bash
docker compose exec app sh
```

### 数据库问题
```bash
# 重置数据库（下次启动会重新从镜像快照初始化）
docker compose exec app rm /app/data/dev.db
docker compose restart app
```

### 爬虫不工作
```bash
# 确认容器内可以导入依赖
docker compose exec app python3 -c "import httpx, bs4, lxml; print('ok')"
# 手动执行一次
docker compose exec app python3 -m crawler.main --limit 1
```

## 默认管理员账号

运行 `npm run db:seed` 将创建默认管理员（可用 `SEED_ADMIN_PASSWORD` 覆盖）：

- 邮箱: `admin@solution.local`
- 密码: `admin123`（默认值，**首次登录后请立即修改**）

**生产环境请在执行 seed 前设置 `SEED_ADMIN_PASSWORD`，不要使用默认密码。**

---

如需帮助，请提交 Issue 或联系开发者。
