# 安装、启动与运行验收技术方案

[English](installation-runtime-validation.md) | 中文

本文给出从 DeepSeek Harness 源码宿主安装 `dsh-shadow-mind`、启动 Web profile、完成真实模型验收和验证重启语义的可执行流程，并定义已发现运行状态缺口的整改方案。已验证流程与目标行为分别标注；整改项只有在实现和自动化验收通过后才视为交付。

## 1. 目标与范围

本方案要求部署者能够在隔离的 Harness home 中固定宿主与插件版本，确认 profile 实际加载 GitHub 构建产物，通过真实 DeepSeek 请求观察一次完整的 root 工具轮次、Shadow 审查、报告 relay 和 root follow-up，并在同一 Session 重启后检查持久数据与进程状态。

本方案同时修正两个可运维性问题：README 缺少源码宿主的端到端操作路径；状态页和 `/shadow status` 没有完整区分持久 Session 治理数据与当前进程诊断数据。它不修改 DeepSeek Harness、替换其凭据系统、持久化活动 child，或保证被强制终止的模型请求恢复执行。

## 2. 已验证基线

2026-08-26 的真实用户路径使用以下基线完成。后续版本可以替换 SHA，但每次验收都必须记录实际提交，不得用可移动分支名充当发布证据。

| 组件 | 已验证版本 | 要求 |
| --- | --- | --- |
| DeepSeek Harness | `0.1.1-rc.2`，源码提交 `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` | 使用源码 checkout 构建并运行 `web` profile |
| dsh-shadow-mind | `6a6892860da8d225442c745f84e9b7764e8bbcc5` | 从 GitHub codeload tarball 安装，不使用本地 link |
| Node.js | `^22.19.0` 或 `>=24.0.0` | 必须满足插件 `engines` |
| pnpm | `10.15.1` | 与插件声明的 package manager 一致 |
| 模型凭据 | `DEEPSEEK_API_KEY` | 只注入启动进程或写入 Harness 凭据存储，不进入仓库 |
| Web 服务 | `http://127.0.0.1:3080` | 启动前检查并处理已有监听进程 |

DeepSeek Harness 处于 developer preview。兼容性验证应同时覆盖上表固定基线和待发布时的目标 Harness 提交；后者失败时不得覆盖已经通过的基线结论。

## 3. 隔离安装流程

以下命令以 Windows PowerShell 为例。占位路径必须替换为新的绝对路径，验收目录不得复用日常 `$DSH_HOME`。

### 3.1 准备宿主、运行 home 与工作区

```powershell
$harnessRepoPath = '<absolute-path-to-new-deepseek-harness-checkout>'
$dshRuntimeHome = '<absolute-path-to-isolated-dsh-home>'
$acceptanceWorkspace = '<absolute-path-to-acceptance-workspace>'
$deepSeekKeyFile = '<absolute-path-to-secret-file>'
$pluginCommit = '6a6892860da8d225442c745f84e9b7764e8bbcc5'

git clone https://github.com/deepseek-ai/deepseek-harness.git $harnessRepoPath
git -C $harnessRepoPath rev-parse HEAD
New-Item -ItemType Directory -Force -Path $dshRuntimeHome, $acceptanceWorkspace | Out-Null

Set-Location $harnessRepoPath
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

`git rev-parse HEAD` 的结果是本次宿主版本证据。若验收目标是固定基线，应在安装依赖前 checkout 已审查的 Harness SHA；若目标是最新默认分支，应保留 clone 后的 SHA，不得只记录“latest”。

### 3.2 安全注入凭据

```powershell
$env:DSH_HOME = $dshRuntimeHome
$env:DEEPSEEK_API_KEY = (Get-Content -LiteralPath $deepSeekKeyFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) {
  throw 'DEEPSEEK_API_KEY is empty'
}
```

命令不得打印变量值。验收结束后在同一 shell 中执行 `Remove-Item Env:DEEPSEEK_API_KEY`。使用 Web 提供方页面保存凭据时，Harness 会把凭据写入 `$DSH_HOME/.credentials.yaml`，该文件也不得复制到仓库、日志或验收附件。

### 3.3 安装固定插件提交

```powershell
pnpm dsh plugin --profile web add "github:whutzefengxie-ops/dsh-shadow-mind#$pluginCommit"
```

安装成功必须同时满足以下条件：

1. `$DSH_HOME/profiles/web/package.json` 的 dependency specifier 等于 `github:whutzefengxie-ops/dsh-shadow-mind#<固定 SHA>`，并且 `dsh.profile.bundles` 包含 `@whutzefengxie-ops/dsh-shadow-mind`。
2. `$DSH_HOME/profiles/web/pnpm-lock.yaml` 的 resolution 指向同一 SHA 的 `https://codeload.github.com/.../tar.gz/<SHA>`，不能是 `link:` 或本地 `file:`。
3. 安装包包含提交的 `lib/`。本插件没有 `prepare`，GitHub 安装不会在用户机器上重新构建源码。

公共仓库安装不依赖 `gh` 登录；`gh` 只用于本仓库的 PR 流程。安装失败时应诊断 pnpm、GitHub 网络访问与 profile 内容，不应改向 DeepSeek Harness 上游仓库提交插件代码。

### 3.4 验证 profile 组合

```powershell
$composedConfig = pnpm dsh --profile web --dump-config | Out-String
if ($LASTEXITCODE -ne 0) { throw 'web profile composition failed' }
foreach ($requiredRow in @('shadow-mind-runtime', 'tool-shadow-mind')) {
  if (-not $composedConfig.Contains($requiredRow)) {
    throw "missing composed row: $requiredRow"
  }
}
```

两行同时存在才证明运行时与管理工具已经进入实际启动树。仅看到 package.json dependency 或 `node_modules` 目录不足以证明插件会被加载。

## 4. 启动与停止

Web 默认监听 `3080`。启动前先定位监听 PID，并核对命令行确实属于待替换的 DSH 服务：

```powershell
$dshListeners = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
$dshListenerPids = $dshListeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($dshListenerPid in $dshListenerPids) {
  Get-CimInstance Win32_Process -Filter "ProcessId = $dshListenerPid" |
    Select-Object ProcessId, ParentProcessId, Name, CommandLine
}
```

只有在核对 PID 和命令行后才能执行 `Stop-Process -Id <verified-pid>`。不得按 `node.exe` 名称批量终止进程。由当前终端启动的旧实例优先使用 `Ctrl+C` 停止，并再次确认端口没有监听者。

使用与安装步骤相同的 `DSH_HOME` 和凭据环境，在 Harness checkout 中前台启动：

```powershell
pnpm dsh web --no-open --port 3080
```

前台运行便于观察启动失败和安全停止。源码启动目录默认成为初始 workspace；实际验收必须在 Web UI 中创建或选择 `$acceptanceWorkspace`，再创建新 Session，避免误把 Harness 源码目录当作用户项目。

## 5. 确定性真实使用场景

### 5.1 准备可检查的工作区输入

在验收 workspace 新建 `RELEASE.md`：

```markdown
# Release readiness

The automated tests pass and the deployment artifact is available.

The release checklist does not define rollback triggers or a recovery procedure.
```

### 5.2 配置 Shadow Mind

打开 **设置 → 插件 → Shadow Mind**，把 heartbeat probability 设为 `1`。创建以下定义；省略 `run_with_model` 使 child 继承 root 路由：

```markdown
---
activation_probability: 1
active_for_models:
  - "*"
capture: since-compaction
context: minimal
debug: false
enabled: true
id: acceptance-reviewer
name: Acceptance Reviewer
think_first: true
---

Review the completed root task using the rendered trajectory. When RELEASE.md says the checklist lacks rollback triggers and a recovery procedure, return status "report", content exactly "Release readiness is blocked: RELEASE.md explicitly omits rollback triggers and a recovery procedure.", verdict "gap", severity 0.9, and refs containing only the rendered seq of the root assistant answer. Do not use tools. Do not return silent or not_relevant for this condition.
```

保存后，定义列表不得出现解析诊断。`capture: since-compaction`、`context: minimal` 和 `think_first: true` 必须保留，分别验证 anchored 截获、最小 context 与同一 child 的先思考后结构化输出路径。需要诊断生命周期时可把 `debug` 临时设为 `true`；日志仍不应包含 prompt、报告正文、工具参数、凭据或绝对路径。

### 5.3 发起真实模型任务

在新 Session 中发送：

> 请使用 `read` 工具读取 `RELEASE.md`，并判断是否满足发布条件。只依据文件内容回答。

root 必须实际产生持久 `tool/result`；只在文本中声称读取文件不合格。Shadow 卡片出现后不要发送新消息，因为真实用户输入会取消本轮审查。

### 5.4 通过标准

一次完整验收必须同时满足：

- root 通过真实 DeepSeek route 完成 `read`；
- 被审查 root 回复下方出现 Shadow `Reviewing` 卡片，随后原位进入 `Report`；
- 报告正文等于定义要求的 release-readiness gap，并带有效的 anchored `refs`；
- 被接受报告以 `shadow-report` provenance 持久写入 root Session，并触发 root follow-up；
- `/shadow status` 在运行终止后显示零 active、零 pending、至少一次运行和最近 relay 终态；
- `think_first` 遥测的 `deliberationChars` 大于零，route 与预期模型选择一致；
- 浏览器控制台没有插件、Typert、Remote、React 或资源加载错误。

已验证基线产生一次 `gap` relay、root follow-up、`deliberationChars=5406`、`same_vendor` 和 `deepseek-official/deepseek-v4-flash` route。数值只证明该次运行，不能作为跨模型的固定阈值。

## 6. 重启与持久性验收

等待 root follow-up 和 Shadow batcher 完全空闲，记录 `/shadow status`，用 `Ctrl+C` 停止服务，确认 `3080` 已释放，再用相同 Harness checkout、`DSH_HOME`、workspace 和凭据重启。恢复原 Session 后，在发送任何新用户消息之前检查设置页、会话卡片和 `/shadow status`。

当前实现的实际结果如下：

| 数据 | 重启后当前行为 | 产品语义 |
| --- | --- | --- |
| 全局设置和 Markdown 定义 | 保留 | 持久配置 |
| 已接受报告、`shadow-report` provenance、锚定 Report 卡片 | 保留 | 持久 Session 事实 |
| active、pending、非 report 终态周期、pause | 清空 | 当前进程控制状态 |
| `totalRuns`、`lastRun`、`prefilterSkips`、`recentReviews`、value-loop 与 synthesis 计数 | 清空 | 当前进程诊断；UI 和命令必须明确标注作用域 |
| `spentChars` 与 budget tier | 清空为 `0`/`standard` | 不符合“自最近一次真实用户消息起”的预算承诺，必须整改 |

已验证 Session 在重启前报告 `1 total runs`、`2363 chars` 和一条最近报告；重启后仍能看到定义、持久报告和 relay 标记，但状态变为 `0 total runs`、`0 chars`、零最近报告且没有 `lastRun`。进程统计归零符合内部类型说明，`spentChars` 归零则允许通过服务重启绕过软硬预算。

## 7. 运行状态整改设计

### 7.1 状态分类

状态必须按以下三类公开，UI、Remote 类型、`/shadow status` 和 README 使用相同措辞：

1. **持久 Session 事实**：已接受 relay 及其 provenance、可由 Session 日志恢复的 anchored Report 卡片。
2. **持久治理状态**：当前 root 自最近一次真实用户消息以来的 `spentChars` 和 budget tier。服务重启不是新的用户消息，不得重置它们。
3. **当前进程诊断与控制**：active、pending、pause、运行周期、`totalRuns`、`lastRun`、prefilter、value-loop、recent review 投影、cooldown、escalation 和 synthesis 计数。它们可以重置，但每个展示位置必须写明“当前进程”。

本整改不把活动 child 或非 report 卡片恢复为可执行任务。进程停止会终止这些生命周期；重启后只恢复持久事实和预算治理。

### 7.2 预算持久化

当前兼容基线没有供树外插件安全追加 `ignorable` 自定义 Session 事件的公开接口。直接写未知 Session event 会使未加载插件的 Harness 拒绝恢复，因此第一阶段使用插件自有、仅含元数据的 sidecar：

```text
$DSH_HOME/shadow-minds/governance/<sha256-of-root-session-id>.json
```

文件名使用 root Session id 的 SHA-256，版本化内容至少包含 `schemaVersion`、`rootSessionId`、最近真实用户消息的 durable sequence、`spentChars`、当前周期的稳定 debit id 集合和更新时间。它不得包含 prompt、报告正文、工具参数、模型响应或凭据。写入通过已有 atomic-write 能力串行化并原子替换；POSIX 新文件请求 `0600`，Windows ACL 由部署负责。

Owner 首次使用时异步加载治理文件；`scheduleTurn` 必须等待加载完成后才能检查预算和准入。未配置预算时，存储失败保留明确诊断并继续使用进程内计数；配置软预算或硬预算后，读取、版本校验或写入失败会进入 governance-error 状态并阻止新的 reviewer 与 synthesizer，不能以 `0` fail-open。从无预算切换到有预算前也必须先持久化当前周期的内存计数。已经准入的工作可以收束，但新的花费必须等待持久状态恢复。

预算更新遵循写前规则：prompt 完成构造并被准入时先持久增加 prompt 字符数，再启动 provider；结构化 report 通过校验时先持久增加 report 字符数，再进入 batcher。Reviewer 与 synthesizer 使用稳定的 debit id，使同一进程中的重试不会重复计费。每次 debit 都比较预算周期，迟到的旧周期结果不能写入新周期。新真实用户消息仍然开启新预算周期，但 reset 只有在对应 durable `user/message` sequence 已知后才提交；服务重启只加载现有周期。

若未来 Harness 提供树外插件可用的 `ignorable` metadata event API，可把同一版本化记录迁移进 Session 日志。迁移前 sidecar 是权威来源，不能同时从两处相加。

### 7.3 展示与命令

设置页把 `totalRuns`、`lastRun`、`recentReviews` 等标签改为“当前进程累计运行”“当前进程最近 Shadow”“当前进程近期报告”。`spentChars` 显示为“自最近真实用户消息起已用字符”，并增加 `disabled`、`loading`、`ready`、`error` 持久化状态。

`/shadow status` 采用同一分组，避免把 `0 total runs` 解释为 Session 从未发生过 Shadow。持久 Report 卡片继续证明历史运行；命令只报告当前进程运行指标和已恢复的当前预算周期。

## 8. 实施顺序与测试

### 阶段 A：文档和作用域

- 发布本方案及 README 入口；
- 明确当前进程统计、持久报告与预算缺口；
- 在升级说明中要求固定宿主和插件 SHA。

验证：Markdown 链接、双语配对、secret/绝对路径扫描和 `git diff --check`。

### 阶段 B：治理存储

- 新增独立 governance store 和版本校验；
- 把 reviewer/synthesizer prompt 与 report debit 接入串行原子更新；
- 在真实用户 durable message 处提交新预算周期；
- 为加载或写入失败增加 fail-closed 状态和稳定原因码。

验证：缺失文件初始化、同周期恢复、新用户 reset、重复 debit、损坏/未知版本拒绝、并发写入、软预算保持 frugal、硬预算保持 exhausted、重启后不得调用超预算 provider。

### 阶段 C：运行时与 Web 语义

- status Remote 暴露治理加载状态；
- UI 与 `/shadow status` 标记所有进程级字段；
- 保留 anchored relay 的现有持久恢复，不伪造已终止周期。

验证：runtime 单元测试、命令输出测试、Web 组件测试和 assembled AgentLoop 重启场景；所有用户可见字符串同步中英文。

### 阶段 D：发布验收

- 对发布 tarball 执行 `pnpm run check` 和构建产物 smoke；
- 在全新 `DSH_HOME` 中按第 3–6 节安装并运行真实模型场景；
- 分别在 `standard`、`frugal` 和 `exhausted` 状态重启，确认预算不下降；
- 发送新的真实用户消息，确认预算周期只在该事件后重置；
- 检查浏览器错误、生命周期诊断和仓库 secret 扫描。

只有自动化重启用例与真实模型验收都通过，才能删除 README 中的预算重启限制。

## 9. 故障定位

| 现象 | 优先检查 | 处理 |
| --- | --- | --- |
| `plugin add` 失败 | Node/pnpm 版本、GitHub codeload 网络、目标 `DSH_HOME` | 保留完整 stderr；公共安装无需 `gh auth` |
| `dump-config` 缺少一行或两行 | 是否使用同一 `DSH_HOME` 和 `web` profile、manifest bundle、lockfile SHA | 重新对固定 SHA 执行 `add`，不要手改 `node_modules` |
| Web 没有 Shadow Mind 设置页 | 服务是否在安装后重启、客户端清单和浏览器控制台 | 先确认两条组合行，再处理客户端加载错误 |
| root 正常回答但没有 Shadow | root 是否产生持久 tool result、heartbeat、定义概率、模型过滤、pause、hard budget、定义诊断 | 用确定性定义逐项排除，不先提高并发 |
| Shadow 运行但没有 relay | 终态是否为 report、输出校验、用户消息取消、epoch 变化、batcher 状态 | 查看卡片原因码；仅 report 会进入 root |
| 重启后 Report 卡片消失 | relay 是否真正写入 `shadow-report` provenance | 非 report 卡片当前不持久；report 缺失是回归 |
| 重启后预算为零 | governance sidecar 是否存在、版本是否支持、加载状态 | 整改发布前属于已知缺口；整改发布后必须 fail-closed 并报警 |
| 模型返回鉴权错误 | 启动进程是否继承 `DEEPSEEK_API_KEY` 或 Harness credential reference | 不打印密钥；修正环境后重启服务 |

## 10. 升级、回滚与清理

升级时用新的已审查 SHA重复执行 `plugin add`，核对 manifest、lockfile 和 `dump-config` 后重启。回滚使用同样命令安装上一个通过验收的 SHA；不得直接修改 profile lockfile。

治理 sidecar 使用独立路径，不含治理存储支持的插件版本会忽略它，因此代码回滚不要求删除文件。需要完全卸载时先执行：

```powershell
pnpm dsh plugin --profile web remove @whutzefengxie-ops/dsh-shadow-mind
```

卸载不会自动删除定义、日志、holdout key 或治理 sidecar。只有在确认精确的隔离 `DSH_HOME` 并完成必要备份后，部署者才可以手动清理 `$DSH_HOME/shadow-minds/`；不得对未解析的环境变量或 home 根目录执行递归删除。
