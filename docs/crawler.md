# 采集器（Python crawler）

采集器是一个独立的 Python 包 `crawler/`，由 Node 侧通过 `execFile` 调用，抓到的内容**以草稿状态入库**，
再在后台人工审核后才公开。

| 组成 | 位置 | 职责 |
|---|---|---|
| CLI 与源注册表 | `crawler/main.py`、`crawler/sources/*.py` | 抓取 → 输出 JSON 到 stdout |
| 依赖 | `crawler/requirements.txt` | `httpx[http2]>=0.27.0`、`beautifulsoup4>=4.12.0`、`lxml>=5.2.0`（无上界、无 lock） |
| 调度与入库 | `src/lib/crawler-ingest.ts` | 起子进程、去重、清洗、写 `Article`(draft) 与 `CrawlLog` |
| 定时注册 | `src/lib/crawler-scheduler.ts` + `src/instrumentation.ts` | 仅生产环境，`node-cron` |
| 触发入口 | `POST /api/admin/crawler/run`、`POST /api/admin/crawler/[id]/run`、后台按钮 | 手动/单源/一键全量 |
| 后台界面 | `/admin/crawler` | 源管理、日志、指标 |

---

## 一、CLI（`crawler/main.py`）

必须**从仓库根目录以模块方式**运行：

```bash
python -m crawler.main                       # 全部源，每源 5 条
python -m crawler.main --list                # 列出可用源（输出到 stderr，不产出 JSON）
python -m crawler.main --source devto --limit 3
python -m crawler.main --format jsonl        # 每行一条 JSON
python -m crawler.main --sequential          # 关闭并行（默认并行）
```

| 参数 | 默认 | 行为 |
|---|---|---|
| `--source <key>` | 无（全部源） | 未命中注册表时打印 `{"status":"error","message":"Unknown source: X"}` 并 **exit 1** |
| `--limit N` | 5 | 强制夹到 `[1, 50]` |
| `--sequential` | false | 关闭线程池；**`--parallel` 是空操作**（默认已并行），别指望用它「打开」并行 |
| `--format json` | json | 单个对象：`{status, sources_processed, sources_succeeded, total, results[], articles[]}` |
| `--format jsonl` | — | **只逐行输出 `articles`**；状态与计数只能从 stderr 日志看 |
| `--list` | false | 打印源 key + base_url |

其他行为：

- 并行用 `ThreadPoolExecutor(max_workers=min(源数, 5))`；`results` 按**完成顺序**追加，故 JSON 中顺序不确定。
- 单个源抛异常只记录 `status:"error"`，不影响其它源。
- **退出码恒为 0**（除非 `--source` 未知）：即使全部源失败，也只是 `status:"error"`，调用方必须解析 stdout。
- 日志走 **stderr**、数据走 **stdout**，便于管道消费。
- 用 `from crawler.sources...` 绝对导入，因此 `python crawler/main.py` 会 `ModuleNotFoundError`（详见 [README](./README.md) 排障）。

---

## 二、数据源（7 个）

| CLI key | 站点 | 请求地址 | 解析方式 |
|---|---|---|---|
| `devto` | dev.to | `https://dev.to/api/articles?tag=computerscience&per_page=N` | **JSON API**（唯一走 API 的源） |
| `stackoverflow_blog` | stackoverflow.blog | 首页 | HTML（bs4 + lxml） |
| `csdn` | blog.csdn.net | `https://blog.csdn.net/nav/ai` | HTML |
| `zhihu` | 知乎 | `https://www.zhihu.com/hot` | HTML |
| `cnblogs` | 博客园 | `https://www.cnblogs.com/pick/` | HTML |
| `hashnode` | hashnode.com | `https://hashnode.com/community` | HTML |
| `hackernews` | Hacker News | 首页（`tr.athing`） | HTML |

- **没有任何一个源使用 RSS/Atom**；6 个 HTML 源靠通用选择器（`a[href]`、`h2,h3`、`article` 等）猜测结构。
- 各源统一输出 6 个字段：`{title, content, source_url, tags, category, author}`；`category` 恒为 `"tech"`；
  `author` 在 csdn/zhihu/cnblogs/hackernews 恒为空串。
- 单源只发 **1 个 HTTP 请求**（列表页），**不抓正文**：`content` 多为标题或列表摘要（CSDN 甚至直接等于标题）。
- 源名与 CLI key 相同，没有独立的人类可读名；入库时 `CrawlLog.sourceName` 存的就是这个 key。

---

## 三、请求行为（`crawler/sources/base.py`）

| 项 | 值 |
|---|---|
| User-Agent | **5 个桌面浏览器 UA 随机轮换**（Chrome 131 win/mac/linux、Firefox 133、Safari 18.2）；每次重试前重新随机 |
| 默认头 | `Accept`、`Accept-Language: zh-CN,zh;q=0.9,en;q=0.8`、`Accept-Encoding: gzip, deflate, br`、`Cache-Control: no-cache`、`DNT: 1`、`Upgrade-Insecure-Requests: 1`；**无 `Referer`、无自定义标识** |
| 超时 / 重定向 | `timeout=30`，`follow_redirects=True` |
| 重试 | 最多 3 次；退避 `2**(attempt-1)` → 等 1s、2s；仅对 `429/500/502/503/504` 重试，其它 4xx 快速失败 |
| 连接池 | `max_keepalive_connections=5`、`max_connections=10` |
| HTTP/2 | 仅在 `import h2` 成功时启用，否则静默降级 HTTP/1.1（不会拖垮全部源） |
| 人为延迟 | 每个源在**成功路径末尾** `random.uniform(1.0, 3.0)` 秒；请求失败会提前返回，**不 sleep** |

---

## 四、Node 侧入库（`src/lib/crawler-ingest.ts`）

```ts
runCrawler({ source?, limit? }) → { status, total, added, skipped, sourcesProcessed, message }
```

1. **互斥**：模块级 `inFlight` 锁，已有任务在跑时直接返回「已有爬虫任务正在运行」（仅单进程有效）。
2. **参数**：`limit` 默认 5，钳制 `[1, 50]`；`source` 必须命中内置白名单（与 `crawler/main.py` 的 `SOURCES` 手工保持同步）。
3. **执行**：`execFile(PYTHON_BIN, ["-m","crawler.main", ...], { timeout: 120s, maxBuffer: 8MB, windowsHide: true, cwd: process.cwd() })`；
   `PYTHON_BIN` 默认按平台取 `python`(win32) / `python3`。
4. **解析**：读 stdout JSON；解析失败按「空结果 + error」处理。
5. **去重与清洗**（逐条）：
   - `sourceUrl`、`title` 任一为空 → `skipped++`；
   - `article.findFirst({ where: { sourceUrl } })` 命中 → `skipped++`（**只按 URL 精确匹配**，不做规范化、不按标题去重）；
   - `title` 截 200、`content` 截 100000（为空时回退标题）、`excerpt` 去标签后截 200；
   - `category` 映射 `{tech→news, news, solution, tutorial, guide, reference}`，未命中归 `news`；
   - 作者挂到系统账号 **`crawler@solution.local`**（首次运行时懒创建，name「内容爬虫」，role `USER`）；
   - `status: "draft"`、`source: "crawled"`、slug 用 `generateSlug()`；
   - 标签走 `resolveTags()` + `connectOrCreate()`，成功后 `bumpTagUsage(+1)`。
6. **日志**：每个源写一条 `CrawlLog`，再写一条整体汇总（`status` 取决于是否有新增或整体成功）。
   `CrawlLog` 的 `sourceId` 只存字符串、**不做外键**，删除数据源后历史日志保留。

---

## 五、定时调度

```
Next 启动 → src/instrumentation.ts 的 register()
          → 仅当 NEXT_RUNTIME === "nodejs" 时【在分支内部】动态 import crawler-scheduler
          → 仅当 NODE_ENV === "production" 时注册 cron
          → hours = clamp(parseInt(CRAWLER_INTERVAL_HOURS || "24"), 1, 23)
          → cron.schedule(`0 */${hours} * * *`, () => runCrawler())
```

- **上限是 23 小时**（`0 */N` 的 N>23 对 node-cron 非法，0 则不调度）。配置里写 `24` 会被静默夹成 `23`
  ——`.env.example` 与 `docker-compose.yml` 的默认值正是 `24`，这是已知的文档/实现不一致（见 [operations.md](./operations.md)）。
- 定时只在**生产**注册，`next dev` 热重载不会重复注册。
- 启动日志：`[crawler] scheduled every 23h (0 */23 * * *)`。
- **为什么拆成两个文件**：应用有 Edge middleware（next-intl）时 Next 会把 `instrumentation` 也编译给 Edge；
  webpack 只在 `if` 死分支内丢弃动态 import，写成「早退 return + 顶层 import」会把 `node-cron`/`child_process`
  带进 Edge 包，`next build` 直接失败。

---

## 六、可观测性与运维

- 后台 `/admin/crawler`：源列表（启停/运行/删除）、一键全量、日志按状态筛选与分页、指标卡（源数、近 24h 失败数、最近成功时间）。
- 每次运行都会写 `CrawlLog`（`status`、`itemsFound`、`itemsAdded`、`message`）；`sourceName` 是 CLI key。
- 抓取结果**永远是草稿**：在 `/admin/content`（文章、状态 `draft`）审核后才会出现在前台。
- 排障速查：

| 现象 | 先看 |
|---|---|
| 全部源 0 条 | 是不是 `http2=True` 但缺 `h2` 包（现在已优雅降级）；再看是否被目标站点反爬拦住（无 JS 渲染拿不到内容） |
| `python crawler/main.py` 报 `ModuleNotFoundError` | 改用 `python -m crawler.main` |
| 容器内爬虫 `ModuleNotFoundError` | Docker runner 的 `PYTHONPATH` 硬编码为 python3.12 的 site-packages，基础镜像 Python 版本漂移会失配（见 [operations.md](./operations.md)） |
| 手动能抓、定时不跑 | 定时只在 `NODE_ENV=production` 注册；`CRAWLER_INTERVAL_HOURS` 会被夹到 1–23 |
| 重复入库 | 去重只按 `sourceUrl` 精确匹配，且 `Article.sourceUrl` **不是唯一索引**；多实例并发下无保护 |

---

## 七、合规与风险（当前状态）

1. **完全不处理 `robots.txt`**：不抓取、不解析、不遵守 `Crawl-delay`（`crawler/` 下无任何相关代码）。
2. **UA 伪装成真实浏览器**（随机桌面 UA + `DNT:1` + zh-CN 语言头）。生产使用建议改成可识别的爬虫 UA 并声明用途/联系方式，
   否则有站点条款与封 IP 的风险。
3. **无 JS 渲染**：知乎 `/hot`、Hashnode `/community`、CSDN `/nav/ai` 这类页面极易只拿到空壳；
   选择器是通用猜测且**仓库内没有任何 fixture 或测试验证其仍然有效**，站点改版即静默失效（表现为「0 条」）。
4. **单请求、不抓正文**：入库的 `content` 质量有限，审核时通常需要人工补写或直接弃用。
5. `requirements.txt` 无上界、无 lock 文件；`Dockerfile` 的 `crawler-deps` 阶段按 `requirements.txt` 安装。

> 后台「新增数据源」目前只是记录元数据：`CrawlSource.enabled` 不参与 cron 调度，新源必须同时在 `crawler/sources/`
> 与 `main.py` 的 `SOURCES` 里实现，且名称要能映射到 CLI key，才能真正运行。
