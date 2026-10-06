# 依赖安全审计修复报告（2026-10）

对 `docs/audit-report.txt` 中 npm audit 报出的漏洞进行修复。本文件记录复核方法、逐项处置、
唯一的残留风险，以及升级引入的行为变更与验证证据。

## 一、结论

| 指标 | 修复前（原始报告） | 修复前（官方 registry 复核） | 修复后 |
|---|---|---|---|
| critical | 1 | 3 | **0** |
| high | 9 | 68 | 7 |
| moderate | 29 | 24 | **0** |
| low | 0 | 2 | **0** |
| 合计 | 39 | 97 | 7 |

- 全部 **critical 与 moderate 已清零**。
- 剩余 7 项是**同一个根因**：传递依赖 `braces`，上游无可用补丁版本，且只存在于构建/lint 工具链。
  详见第三节。
- 未采用 `npm audit fix --force`：它会直接把 `next` 拉到 16.3.8、`tailwindcss` 拉到 4.3.3，
  是无差别的跨主版本跳跃，不是最小修复。所有升级都按公告给出的**最低修复版本**逐项选取。

## 二、复核方法（以及为什么数字和原报告不一致）

原报告由本机 `npm audit` 生成，而本机 `.npmrc` 指向 `registry.npmmirror.com`：

```
npm warn audit 404 Not Found - POST https://registry.npmmirror.com/-/npm/v1/security/advisories/bulk
npm error audit endpoint returned an error
```

npmmirror 没有实现 audit 端点，原报告使用的是镜像侧一份**不完整**的公告库，因此只列出 39 项。
本次复核统一改用官方 registry：

```bash
npm audit --registry=https://registry.npmjs.org/
```

同一份 `package-lock.json` 下官方库报出 97 项——差额主要是 `brace-expansion` / `minimatch` /
`js-yaml` / `undici` / `source-map-js` / `browserslist` 等传递依赖的公告，镜像库未收录。

> 修复后的基线快照见 [`npm-audit-after-fix.txt`](./npm-audit-after-fix.txt)。

## 三、逐项修复

对应 7 个提交（按时间顺序）。

### 1. `7135794` — 让 `npx tsc --noEmit` 可用（前置修复）

仓库根目录的 `tsconfig.tsbuildinfo` 在本机被占用，`tsc` 写增量缓存时报
`TS5033 / 访问被拒绝`，AGENTS.md 规定的类型检查根本无法执行（此前只能靠
`--incremental false` 绕过）。通过 `tsBuildInfoFile` 把缓存改写到 `.next/cache/` 下。
无编译行为变化。

### 2. `b6fc728` — 传递依赖 overrides（97 → 40）

这些包都有兼容范围内的已修补版本，用 `overrides` 钉住即可，不做任何主版本跃迁：

| 包 | 修复前 → 修复后 | 说明 |
|---|---|---|
| `postcss` | 8.5.15 → 8.5.29 | 含 `next` 内嵌的那份；另修 `nanoid`、`source-map-js` |
| `js-yaml` | 4.2.0 → 4.3.2 | 仅 eslint 链路使用 |
| `brace-expansion` | → 1.1.21 / 2.1.7 / 5.0.12 | **按 `minimatch` 主版本分别钉**，避免跨主版本覆盖破坏 minimatch 3.x 的函数式 API |
| `glob`（`@next/eslint-plugin-next` 内） | 10.3.10 → 10.5.0 | 修 GHSA-5j98-mcp5-4vw2（CLI `-c` 命令注入） |
| `browserslist` | 4.28.2 → 4.29.3 | 连带 `baseline-browser-mapping`、`update-browserslist-db` |
| `undici` | 7.27.2 → 7.30.0 | 24 条公告 |
| `esbuild` | 0.28.0 → 0.28.2 | 并同步更新 `allowScripts` 版本键，保证 postinstall 未被拦截 |
| `@eslint-community/eslint-utils` | 4.9.1 → 4.10.1 | |

### 3. `77c692b` — Tiptap 2 → 3.31.4（40 → 10）

GHSA-cp6q-959q-f8rh（`mergeAttributes()` 把自有 `__proto__` 键变成可执行的继承 DOM 属性）
影响 `@tiptap/core` 全系 2.x，上游未回补 2.x。连带修掉 `@tiptap/pm` 2.x 引入的
prosemirror-view 粘贴 XSS（GHSA-c8x8-7fp4-3x9w）与 markdown-it / linkify-it 的二次方复杂度 DoS
（`@tiptap/pm` 3 已不再依赖 `prosemirror-markdown`）。

组件侧适配（`src/components/client/RichEditor.tsx`）：

- 显式 `immediatelyRender: false`——Tiptap 3 默认在服务端渲染编辑器，Next.js 下必然 hydration 不一致；
- StarterKit 3 内置了 Link 扩展，用 `link: false` 关掉内置副本，保留原有的显式
  `LinkExtension` 配置（`openOnClick` / `rel` / `target` 行为不变）。

### 4. `b49c2df` — dompurify 3.4.10 → 3.4.16（10 → 9）

修 GHSA-6688-9rhm-gjv2 等 4 条。dompurify 是本站所有 HTML 汇聚点的净化器
（`src/lib/sanitize.ts`、`RichEditor`、`CommentSection`、`AnswerItem`），属**实际可达**的攻击面。

`isomorphic-dompurify` 保持 3.16.0：其 3.17+ 要求 Node `^22.22.2`，而 `Dockerfile` 用
`node:20-alpine` 构建，升级会直接打断镜像构建。该包声明 `dompurify ^3.4.8`，因此根依赖升到
3.4.16 后两处都已去重到已修补版本。

### 5. `63b2293` — next-auth 5.0.0-beta.31 → beta.32（9 → 6）

`@auth/core` 0.41.2 → 0.41.3，修 4 条 Auth.js 公告：

- **GHSA-8fpg-xm3f-6cx3（critical）** 配置错误时 `auth` 对象带着 error 仍被判为已认证，存在性检查 fail-open；
- **GHSA-7rqj-j65f-68wh（critical）** 邮箱规范化在 Unicode 归一化之前校验，可用同形字符绕过 `@` 校验；
- **GHSA-xmf8-cvqr-rfgj（high）** `getToken()` 遇到畸形 Bearer 头抛未捕获异常；
- **GHSA-x445-f3h2-j279（moderate）** OAuth state/nonce/PKCE cookie 未与发起方绑定。

### 6. `504be44` — Next 14.2.35 → 15.5.27 + React 19（6 → critical 归零）

Next.js 14.x 已 EOL。GHSA-p293-qw3h-jr36（Windows 托管服务器未授权 RCE）、
GHSA-2xp9-vwfh-vxw4（AVIF 图片优化未授权 RCE）等公告在 14.x **没有任何回补版本**，
修复基线是 15.5.24，本次取 15.5.27（15.x 最新）。App Router 下的 Next 15 需要 React 19，
因此一并升级 `react` / `react-dom` / `@types/react`。

peer 依赖同步升级以保证 React 19 兼容：

| 包 | 版本 | 备注 |
|---|---|---|
| `next-intl` | 4.14.9 | |
| `next-themes` | 0.4.6 | |
| `sonner` | 2.0.8 | 主版本升级，`toast()` / `<Toaster />` API 未变 |
| `lucide-react` | 0.577.0 | **停在最后一个 0.x**：1.x 移除了 `Github` / `Twitter` 等品牌图标，本项目在页脚和登录页使用 |
| `eslint-config-next` | 15.5.27 | |

代码适配：

- **Next 15 起 `params` / `searchParams` 是 Promise**：8 个页面 + 27 个路由处理器的签名改为
  `Promise<...>` 并在函数体首行 await（保留既有 `params.x` 用法，改动面最小）；
- **`next/headers` 的 `cookies()` 变成异步**：`src/lib/api-i18n.ts` 的 `getRequestLocale`
  改为 async，`src/app/api/rss/route.ts` 相应 await；
- **`src/instrumentation.ts` 拆分**：应用存在 Edge middleware（next-intl）时，Next 会把
  `instrumentation` 同时编译给 Edge runtime，而 webpack **只在 `if` 死分支内**丢弃动态 import，
  早退 `return` 之后的 import 仍会进 Edge 包。改为把 `node-cron` / `child_process` 那部分挪到
  `src/lib/crawler-scheduler.ts`，并在 `NEXT_RUNTIME === "nodejs"` 分支内动态 import。
  **修复前 `npm run build` 直接失败**。

### 7. `ae2beda` — postcss-selector-parser 钉到 7.1.6（moderate 归零）

GHSA-rj75-hqrm-r3gf 的受影响范围是 `<7.1.6`，但 `tailwindcss@3` 声明的是 `^6.0.11`，
`npm audit fix` 只会升到 6.1.4、仍在受影响区间内（npm 提示的 "fix available" 在这条上是误导性的）。
因此用 override 强制到 7.1.6。

风险控制：7.1.6 仍是 CJS（`main: dist/index.js`），`postcss-nested` 6.2.0 只用到
`parser().processSync()` 这一稳定入口。实测覆盖前后 `next build` 产出的 CSS
**文件名、体积与 SHA-256 完全一致**（`f87e65cc66a754a0.css` / 68249 bytes / `E94A4EA88711ED0A`），
属行为等价升级。

## 四、残留风险：`braces`（唯一未修复项，7 条）

### 上游状态

- 公告：GHSA-vfj7-8cjw-p6xm / CVE-2026-93687，深度嵌套模式导致栈耗尽 DoS。
- 受影响范围 `<=3.0.3`，而 **`braces` 的最新发布版就是 3.0.3** → **上游没有可升级的补丁版本**。

### 为什么升 Tailwind 4 也解决不了

依赖树里有**两条**引入路径：

| 路径 | 能否切断 |
|---|---|
| `tailwindcss@3` → `chokidar` / `fast-glob` / `micromatch` → `braces@3.0.3` | ✅ 升 Tailwind 4（v4 已无任何 npm 依赖）可切断 |
| `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob@3.3.1` → `micromatch` → `braces@3.0.3` | ❌ `@next/eslint-plugin-next` 15.5.27 与**最新** 16.3.8 都硬依赖 `fast-glob@3.3.1` |

即 Tailwind 4 迁移**在安全上拿不到收益**，`braces` 仍会经由 ESLint 工具链留在报告里，
只是审计条目从 8 条降到 5 条（同一根因），却要付出 PostCSS 配置、675 行 `globals.css`、
`tailwind.config.ts` 的 CSS-first 迁移代价，以及 v4 工具类语义变化
（默认边框色、`shadow-*` / `rounded-*` 重命名、`outline-none` 行为等）带来的视觉回归风险。
**经确认后决定不做**（原计划包含该项）。

### 可达性分析：接受该风险的理由

1. **不在生产产物里。** `next.config.mjs` 配置 `output: "standalone"`，实测生产镜像
   `.next/standalone/node_modules`（45 个包）中 **不含** `braces` / `micromatch` / `chokidar` /
   `fast-glob` / `tailwindcss` / `eslint`——它们全部来自 `devDependencies`。
2. **输入不可控性为零。** 触发条件是向 glob 匹配器传入极深嵌套的模式串；这些模式来自仓库自身的
   Tailwind `content` 配置与 ESLint 插件的目录扫描，**不由终端用户提供**，也不经过任何请求路径。
3. **影响面是本地开发/CI 卡死**，不是数据泄露、权限绕过或远程执行。

### 处置与监控

- 记录为**已接受风险**，不通过 `--force` 或跨主版本覆盖去"消音"。
- 监控条件：`braces` 发布 > 3.0.3 后，`npm install braces@latest` + 重新审计即可清掉这 7 条；
  届时无需任何代码改动。
- 若将来确实要求审计清零，唯一的路径是拆掉 `@next/eslint-plugin-next`
  （改用 ESLint 9 扁平配置、放弃 `next/core-web-vitals` 规则与 `next lint` 命令）——
  代价明显大于收益，本次未做。

## 五、升级引入的行为变更（需要人工确认的部分）

| 变更 | 影响 | 需要你做什么 |
|---|---|---|
| Next 14 → 15、React 18 → 19 | 运行时主版本跃迁 | **建议做一次完整回归**（登录/发帖/评论/投票/后台上传等写路径） |
| Tiptap 2 → 3 | 富文本编辑器行为 | 建议手动过一遍编辑器：加粗/列表/代码块/链接/图片/Markdown 源码与分屏模式 |
| sonner 1 → 2 | toast | API 未变，视觉可能有微调 |
| lucide-react 0.378 → 0.577 | 图标 | 已停在 0.x 末版以保住 `Github` / `Twitter` 品牌图标 |
| `tsconfig.json` 新增 `tsBuildInfoFile` | 增量缓存位置 | 无；顺带让仓库根目录不再产生 `tsconfig.tsbuildinfo` |
| `src/instrumentation.ts` 拆分 | 定时爬取注册 | 已实测：生产启动日志 `[crawler] scheduled every 23h (0 */23 * * *)` |
| **未做** Tailwind 3 → 4 | 样式基线 | 无变更，样式与升级前一致 |

`next lint` 在 Next 15 已标记废弃（本次仍可用且通过），**Next 16 会移除**。
将来升级 Next 16 时需迁移到 ESLint CLI：

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

## 六、验证记录

树冻结后（最后一次源码/依赖改动 = `ae2beda`）执行的完整自检：

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | exit 0，无类型错误 |
| `npx next lint` | ✔ No ESLint warnings or errors（仅打印 `next lint` 废弃提示） |
| `npm run i18n:check` | No i18n problems found（zh/en 各 1009 键） |
| `npm run build` | ✔ Compiled successfully，31/31 静态页 + 全部路由 + middleware，exit 0 |

> `next build` 前已确认无 `next dev` 占用 `.next`（见 `dev-environment.md` 第 1 节）。

生产产物运行时冒烟测试（`next start`，Node v24.16.0，随后已停止）：

| 路由 | 结果 |
|---|---|
| `/`、`/en` | 200 |
| `/zh/solutions`、`/zh/software`、`/zh/questions` | 200 |
| `/zh/search?q=react` | 200 |
| `/zh/tags/windows`（动态段） | 200 |
| `/zh/solutions/mt133yfcjzzcsy`、`/en/solutions/<slug>`（动态段） | 200 |
| `/zh/solutions/this-slug-does-not-exist` | 200（not-found 页，未崩） |
| `/zh/solutions?category=nonexistent&page=99` | 200（越界参数未崩） |
| `/zh/admin`、`/zh/admin/dashboard`（未登录） | 200，回落到登录页 |
| `/api/rss`、`/api/tags`、`/sitemap.xml` | 200 |
| `/zh/docs` | 308 → `/zh/solutions`（重定向规则仍生效） |
| 服务端日志 | 无 error / unhandled |

## 七、后续建议

1. **轮换 `AUTH_SECRET`**：`code-audit.md` 第 4 条记录它已进入 git 历史，与本报告无关但仍未处理。
2. **把 audit 纳入 CI**：本机默认 registry 不支持 audit，CI 里应显式加
   `--registry=https://registry.npmjs.org/`，否则会静默失败。
3. **保持 overrides 的最小性**：`package.json` 的 `overrides` 是安全补丁的临时载体，
   上游发版后应逐条移除；`brace-expansion` 按 `minimatch` 主版本分档的写法尤其不要合并成一条。
4. **Docker 基础镜像**：若要跟进 `isomorphic-dompurify` 3.20+/4.x、以及 Next 16，
   需要先把 `Dockerfile` 的 `node:20-alpine` 提到 `node:22`。
