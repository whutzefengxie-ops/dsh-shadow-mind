# dsh-shadow-mind

中文 | [English](README.md)

这是一个独立版本化的 DeepSeek Harness 组合包。符合条件的 root agent 工具轮次结束后，它会启动全新的后台 Shadow agent，校验结构化发现，把被接受的报告持久化转发给 root，并在 Web 界面中提供配置和执行证据。

## 思路来源

本项目的核心设计思路来源于 [pi-shadow-mind](https://github.com/liuzhengdongfortest/pi-shadow-mind.git)。本仓库是面向 DeepSeek Harness 插件体系的独立实现，并非该项目的官方分支；运行时、Session、subagent、权限、持久化和 Web 界面均基于 DeepSeek Harness 的扩展机制实现。

## 安装

插件要求 DeepSeek Harness `0.1.1-rc.2` 或兼容的 master 构建。从 GitHub 安装时应固定已经审查的 commit：

```sh
dsh plugin --profile web add github:whutzefengxie-ops/dsh-shadow-mind#<commit-sha>
```

开发时可安装本地 checkout：

```sh
dsh plugin --profile web add /path/to/dsh-shadow-mind
```

安装后重启对应 profile。无需启动 Web 服务即可检查组合结果：

```sh
dsh --profile web --dump-config
```

输出必须包含 `shadow-mind-runtime` 和 `tool-shadow-mind`。更新时用新的已审查 SHA 再执行一次 `add`；卸载命令是：

```sh
dsh plugin --profile web remove @whutzefengxie-ops/dsh-shadow-mind
```

GitHub 安装直接使用仓库提交的 `lib/`。本包没有 `prepare` 脚本，不要求在 pnpm 中配置 `allowBuilds`。

## 配置

进入 **设置 → 插件 → Shadow Mind**。该页面提供：

- heartbeat 概率、并发数、超时、报告批处理、模型路由、reasoning effort、披露策略和长度上限等实时调度设置；
- 由 Markdown 保存的 Shadow 定义，包括名称、激活概率、模型过滤、运行模型、截获视窗、context 继承、think-first 执行、谓词、holdout 模式、工具和提示词；
- 当前所选 root Session 的暂停、恢复和状态控制；
- 定义目录和逐文件诊断。

定义保存在 `$DSH_HOME/shadow-minds/*.md`。以下定义适合确定性验收：

```markdown
---
id: acceptance-reviewer
name: Acceptance Reviewer
enabled: true
debug: false
activation_probability: 1
active_for_models:
  - '*'
tools: []
capture: since-compaction
context: minimal
think_first: true
---

Review the completed task. If there is a concrete defect or missing requirement, return a concise report with verdict `challenge` or `gap` and only rendered sequence numbers in `refs`. Return `silent` when the review applies but adds nothing actionable, or `not_relevant` when it does not apply.
```

验收时把全局 heartbeat 概率设为 `1`。省略 `run_with_model` 时 child 继承 root 的模型路由；如需单独模型，应填写完整的 `provider/model`。默认 Shadow 工具为 `read`、`grep` 和 `glob`；定义中的工具会扩展 allowlist，如果继承的 sandbox 允许，它们也可能具有写入能力。[`examples/shadow-minds/`](examples/shadow-minds/) 中默认禁用的 starter library 展示 anchored probe 词汇，安装过程绝不会自动把它写入 `$DSH_HOME`。

### 把 Shadow 绑定到 DSH 的模型与 Agent 预设

每个 Shadow 子代理——评审影子、冲突综合与命令闸门法官——都可以绑定 DSH 部署中已配置的供应商、模型与思考强度。设置页提供供应商 / 模型 / 思考强度三级联动下拉框（数据来自 DSH 实时 LLM 目录，含每个模型公布的适配器思考强度），以及 DSH Agent 预设下拉框：绑定预设后，子代理沿用该预设的 `persona` 组合。磁盘与 wire 格式仍是 `provider/model` 路由字符串，因此面向模型的管理工具无需改动。

## 命令闸门

命令闸门在**执行前**阻断主 agent 的 `pwsh`（以及任意配置的工具）调用，并分三层裁决：

1. **拒绝模式**——正则命中即 0 延迟拒绝（默认覆盖 `Stop-Process`、`Stop-Service`、`taskkill`、`shutdown`、递归删除等破坏性命令），不产生任何模型成本；命中受保护进程/服务名的命令会在拒绝原因中点名目标。
2. **放行模式**——只读命令（默认覆盖 `Get-*`、`pwd`、`git status/diff/log` 等）在未命中拒绝模式时立即执行。
3. **闸门法官**——其余命令唤起绑定到法官模型（未配置时继承主 agent 模型）的全新 Shadow 子代理，返回结构化 `allow`/`deny` 与理由。法官提示词包含你的环境声明、受保护进程/服务名单、工作区、完整命令与有界的近期轨迹；主 agent 的 turn 会阻塞等待裁决。法官超时或失败时按失败策略处理（`deny` 为 fail-closed 默认值，`allow` 为 fail-open）。相同命令在 TTL 窗口内复用上次裁决，法官并发有上限。

首要场景是防止改项目时主 agent 误杀生产环境服务：在 **设置 → 插件 → Shadow Mind → 命令闸门** 中声明保护名单（或环境说明），启用闸门后，破坏性命令在到达 shell 之前就会被拦下。裁决会审计到 `$DSH_HOME/shadow-minds/logs/command-gate.jsonl`，`/shadow status` 会报告闸门拒绝/放行/法官计数。闸门**默认关闭**，且永远不会审查 Shadow 子代理自身。

## 验证实际运行

只有包含至少一个持久化工具结果的已完成 root 轮次才会触发调度。在新会话中明确要求主 agent 读取一个仓库文件再分析。`/shadow status` 会显示等待调度数、活动运行数、累计准入运行数和最近结果。

Shadow 进入调度后，被审查的 root 回复下方会立即出现运行占位卡片；卡片会明确提示此时发送新消息会取消本轮审查。完成后，同一位置原位更新为报告、静默、无关、中断或失败终态，多轮审查不会合并到会话末尾。报告正文复用 DSH 的 Markdown 渲染，支持 GFM、表格、代码块和 TeX，并保留官方的不安全内容过滤。

被接受的报告会成为 root Session 中持久化的用户消息并触发 follow-up，但该 relay 只更新触发位置的既有卡片，不再生成尾部卡片。`silent`、`not_relevant`、`aborted` 和 `failed` 都有可见卡片，但不会注入主 agent，因此不会由展示状态形成 Shadow 循环。

需要分析生产问题时，在对应定义中设置 `debug: true`。`$DSH_HOME/shadow-minds/logs/<shadow-id>.jsonl` 会按 run 记录准入、child 启动、取消请求、终态和报告投递，包含阶段、稳定原因码、取消来源与 provider stop reason。日志不记录 prompt、报告正文、工具参数、凭据、绝对路径或 stack；例如用户新消息取消为 `USER_MESSAGE_RECEIVED`，Shadow 超时为 `SHADOW_TIMEOUT`，无法归因给插件的 provider 中断为 `PROVIDER_ABORTED`。

## 安全与限制

默认轨迹投影会移除推理、原始工具结果文本和工具参数。用户及 assistant 文本中的 prompt injection 仍然可能进入投影，因此工具 allowlist、继承的 sandbox、固定的 child approval 策略和披露上限仍是必要的安全控制。

定义按一个 Harness home 全局生效，不按 profile 或 workspace 隔离。Child Session 遵循 Harness 的持久化策略。并发 Shadow 之间没有共享事务；一旦启用写入型工具，它们可能与 root 或其他 Shadow 发生竞争。

已接受报告及其 anchored 卡片会在服务重启后恢复。运行计数、最近运行诊断、非 report 生命周期卡片和暂停状态属于当前进程。当前版本还会在重启时把 `spentChars` 清零，因此下一条真实用户消息到来前，重启可以重新打开已经达到的软预算或硬预算。

[安装、启动与运行验收技术方案](docs/installation-runtime-validation.zh.md)给出可复现的源码宿主部署、真实模型验收、重启检查与预算持久化整改步骤。[目标架构](docs/target-architecture.zh.md)、[审查条件机制](docs/review-conditioning.zh.md)与[审查质量方向](docs/review-quality-directions.zh.md)记录当前运行时契约；[技术方案](docs/technical-design.zh.md)保留 Pi 参考实现分析和独立发行拓扑。提交日志或更新安装 commit 前请阅读 [SECURITY.md](SECURITY.md)。

## 开发

```sh
pnpm install
pnpm run check
```

`lib/` 是需要审查并提交的发布产物；源码行为变化时必须同步更新。禁止提交本地 Harness 状态、凭据、Session、日志或验收导出文件。
