# 工程环境陷阱

记录在本项目开发过程中实际踩到的环境问题：**症状 → 原因 → 处置**。这些问题与业务代码无关，但会浪费大量排查时间，且症状极具误导性。

---

## 1. `next dev` 与 `next build` 并发会互相破坏构建产物

### 症状（本会话全部真实出现过）

| 现象 | 具体报错 |
|---|---|
| 构建中途失败 | `Error: Cannot find module '.next\server\middleware-manifest.json'` |
| 收集产物阶段失败 | `⚠ Failed to copy traced files ... ENOENT ... page_client-reference-manifest.js`、`prerender-manifest.json` |
| 收集页面数据阶段崩溃 | `unhandledRejection Error [PageNotFoundError]: Cannot find module for page: /_document` |
| 源码读取异常 | 同一文件瞬时读到 **0 字节** |
| 类型错误"忽有忽无" | `tsc` 上一次 0 错误，下一次冒出 5 个；修完又冒出新的 |
| 文件内容自己变了 | 同一文件两次读取字节数不同（11963 → 12039），损坏行已被替换 |

### 原因

`next dev` 与 `next build` **共用同一个 `.next` 目录**。两者同时运行会不断覆写/删除对方的中间产物，产生上述随机失败。本工作区实测存在：

- 常驻的 `npm run dev`（`next dev -p 3000`）
- 外部会话/agent 并发编辑同一批源文件
- 两个 `next build` 同时运行

### 处置

**构建前先停掉 dev server，且不要并发跑两个构建。**

已被写坏的 `.next` 直接删除重建即可（它是可再生的构建缓存，已被 `.gitignore` 忽略）：

```powershell
Remove-Item -Recurse -Force .next
npx next build
```

### 检测当前是否有并发进程

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  $cl = $_.CommandLine
  if ($cl -and $cl -match 'next|npm') {
    "PID $($_.ProcessId) [start $($_.CreationDate)]: $($cl.Substring(0,[Math]::Min(120,$cl.Length)))"
  }
}
```

关注输出中的 `next dev`、`next build`、`npm-cli.js run build`、`jest-worker`。

> **经验**：在这个工作区里，任何"构建随机失败"的现象，先怀疑并发，而不是先怀疑代码。

---

## 2. ⚠️ 用 PowerShell 改源文件会损坏中文

### 症状

- 读取工具报 `invalid UTF-8 text`
- 中文变成乱码：`方案未找到` → `鏂规鏈壘鍒?`
- 文件能打开但内容不可逆损坏（**无法用编码转换恢复**）

### 原因

`Get-Content` / `Set-Content` 默认使用**系统 ANSI 编码（简体中文 Windows 上是 GBK）**，而源码是 UTF-8。一次"读取-替换-写回"就会把 UTF-8 中文按 GBK 解码再按 GBK 编码，产生不可逆损坏。

本会话曾因此一次性损坏 **5 个源文件**（`layout.tsx`、`robots.ts`、`docs/[slug]/page.tsx`、`questions/[slug]/page.tsx`、`software/[slug]/page.tsx`），最终靠 `git checkout -- <file>` 恢复并重新应用修改。

### 处置

- **首选**：用编辑器或文件编辑工具改源码，不要用 shell 文本管道。
- 必须在 PowerShell 中读写时，显式指定 UTF-8（无 BOM）：

```powershell
$p = 'D:\Project\Web\Solution\src\some\file.tsx'
$utf8 = New-Object System.Text.UTF8Encoding($false)          # $false = 不写 BOM
$text = [System.IO.File]::ReadAllText($p, $utf8)
$text = $text.Replace('old', 'new')
[System.IO.File]::WriteAllText($p, $text, $utf8)
```

- 已损坏且未提交 → 从 git 恢复：`git checkout -- <file>`（会丢失该文件的未提交改动，需重新应用）。
- 校验文件是否为合法 UTF-8：

```powershell
$bytes = [System.IO.File]::ReadAllBytes($p)
$strict = New-Object System.Text.UTF8Encoding($false, $true)   # $true = 遇到非法字节抛异常
try { $null = $strict.GetString($bytes); "valid UTF-8" } catch { "INVALID: $($_.Exception.Message)" }
```

---

## 3. PowerShell 的 `-Path` 把 `[ ]` 当通配符

### 症状

```text
Get-Content : An object at the specified path src\app\[locale]\(main)\docs\[slug]\page.tsx
does not exist, or has been filtered by the -Include or -Exclude parameter.
```

### 原因

本项目大量使用 Next.js 动态路由目录（`[locale]`、`[slug]`、`[type]`、`[id]`），方括号在 PowerShell 路径中是**通配符语法**。

### 处置

对这类路径一律使用 `-LiteralPath`：

```powershell
Get-Content -LiteralPath 'src\app\[locale]\(main)\docs\[slug]\page.tsx'
Get-Item    -LiteralPath 'src\app\[locale]\admin\crawler\page.tsx'
```

### 附带影响

用 `Select-String -Path` 搜索多个文件时，含方括号的路径会被静默跳过 → **搜索结果看似"没有匹配"，实际是没搜到这些文件**。搜索源码请用 rg/grep 类工具，或逐个用 `-LiteralPath`。

---

## 4. 沙箱 ACL 导致 `pwsh` 工具完全无法启动

### 症状

```text
Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\Project\Web\Solution)
```

`pwsh` 工具在**执行任何命令之前**就失败（连 `Write-Host "hello"` 都不行）。

### 原因

DSH 沙箱需要在工作区目录上授予临时写权限；而 `D:\Project\Web\Solution` 缺少当前用户的**取得所有权（WRITE_OWNER）**权限，授权流程失败。注意此时目录的读权限与 `WRITE_DAC` 都是正常的，所以"文件明明能读写"却报权限错，很容易误判。

### 处置

使用配套的诊断脚本（一次调用完成诊断 + 修复 + 校验）：

```powershell
& '<skill-dir>\scripts\diagnose-windows-sandbox-acl.ps1' `
    -Path 'D:\Project\Web\Solution' `
    -AllowRoot 'D:\Project\Web\Solution' `
    -Out 'D:\Project\Web\acl-reports'
```

- 脚本会**先备份**原始权限再修改，并打印可撤销每项改动的回滚命令。
- 因写入权限本身受限，需在**非受限（完全权限）**模式下运行——受限运行会把沙箱自身的限制误报成"缺少权限"。
- 恢复记录与回滚脚本位于 `-Out` 指定目录（本会话为 `D:\Project\Web\acl-reports\`）。

---

## 5. 沙箱禁止进程 spawn（Prisma CLI / tsx 不可用）

### 症状

```text
Error: Schema engine exited. Error: Command failed with EPERM:
node_modules\@prisma\engines\schema-engine-windows.exe cli --datasource ... spawn EPERM
```

`npx prisma db push`、`npx prisma generate`、`npx tsx` 均报 `spawn EPERM`；Node 脚本内用 `child_process.execSync` 调用外部程序同样失败。

### 处置

- **在普通终端**（非沙箱）执行 Prisma CLI 与 tsx。
- 仅需改数据库结构时，可绕过 CLI，直接用 Prisma Client 的原生 SQL（无需 spawn schema-engine）：

```js
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SlugRedirect" (...) `);
```

- 代码层面若不想依赖 `prisma generate` 的新模型类型，可在该处使用 `$queryRawUnsafe` / `$executeRawUnsafe`（本项目的 `src/lib/slug-redirect.ts`、`prisma/seed-redirects.ts` 即为此设计）。
- 注意：`prisma generate` 未运行前，新模型在 Prisma Client 上**没有类型**（`Property 'slugRedirect' does not exist`）。在普通终端跑一次 `npx prisma generate` 即可，`postinstall` 已配置该命令。

---

## 6. 源码中出现非法 UTF-8 字节（截断的多字节序列）

### 症状

读取工具报 `invalid UTF-8 text`，但文件在编辑器里看着正常（编辑器通常容错显示）。

### 实例

`src/app/[locale]/admin/crawler/page.tsx` 中本应是 em dash `—`（UTF-8 为 `E2 80 94`）的位置，实际字节是 **`E2 80 3F`** —— 第三个字节被替换成了 `?`(0x3F)，形成非法序列。

### 检测

扫描文件中所有非法的多字节序列位置：

```powershell
$bytes = [System.IO.File]::ReadAllBytes($p)
$i = 0
while ($i -lt $bytes.Length) {
  $b = $bytes[$i]
  if ($b -lt 0x80) { $i++; continue }
  $len = if ($b -ge 0xF0) { 4 } elseif ($b -ge 0xE0) { 3 } elseif ($b -ge 0xC2) { 2 } else { 1 }
  $ok = $true
  for ($k = 1; $k -lt $len; $k++) {
    if ($i + $k -ge $bytes.Length -or $bytes[$i+$k] -lt 0x80 -or $bytes[$i+$k] -gt 0xBF) { $ok = $false; break }
  }
  if (-not $ok) { "invalid at pos=$i : " + (($bytes[$i..([Math]::Min($i+3,$bytes.Length-1))] | ForEach-Object { '{0:X2}' -f $_ }) -join ' ') }
  $i += $len
}
```

### 处置

定位到具体字节后**按字节精确修补**，并且**写入前先校验当前字节符合预期**（避免在并发改写时误写）：

```powershell
if ($bytes[$pos] -eq 0xE2 -and $bytes[$pos+1] -eq 0x80 -and $bytes[$pos+2] -eq 0x3F) {
  $bytes[$pos+2] = 0x94        # 还原为 E2 80 94（em dash）
  [System.IO.File]::WriteAllBytes($p, $bytes)
} else { "ABORT: 字节与预期不符，未写入" }
```

> **重要**：若怀疑有其他进程正在改同一文件，先停掉它们再修补；带条件校验的写法能避免把别人的新改动覆盖掉。

---

## 7. 并发编辑下的安全操作清单

本工作区同时存在 dev server 与外部编辑进程，操作时注意：

1. **改源码前后都读一次**：确认内容与自己预期一致（本会话出现过"刚读完就被改写"）。
2. **不要用会重写整文件的 shell 管道**（见第 2 条）。
3. **构建/长任务前先确认没有并发构建**（见第 1 条）。
4. **写入前做条件校验**，尤其是字节级操作与批量替换。
5. **临时产物用完即删**：本会话产生的 `build*.log`、`tsc*.log`、`.playwright-cli/`、截图等都已清理，避免污染仓库。
6. **不要删除他人正在使用的目录**：`.next` 可删（可再生），但 `src/`、`prisma/`、`scripts/` 下的临时文件可能是他人未完成的工作，不要擅自清理。
