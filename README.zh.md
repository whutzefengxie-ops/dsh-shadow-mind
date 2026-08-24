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
- 由 Markdown 保存的 Shadow 定义，包括名称、激活概率、模型过滤、运行模型、工具和提示词；
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
---

Review the completed task. If there is a concrete defect or missing requirement, return a concise report with evidence. Otherwise return not_relevant.
```

验收时把全局 heartbeat 概率设为 `1`。省略 `run_with_model` 时 child 继承 root 的模型路由；如需单独模型，应填写完整的 `provider/model`。默认 Shadow 工具为 `read`、`grep` 和 `glob`；定义中的工具会扩展 allowlist，如果继承的 sandbox 允许，它们也可能具有写入能力。

## 验证实际运行

只有包含至少一个持久化工具结果的已完成 root 轮次才会触发调度。在新会话中明确要求主 agent 读取一个仓库文件再分析。`/shadow status` 会显示等待调度数、活动运行数、累计准入运行数和最近结果。

Shadow 进入调度后，被审查的 root 回复下方会立即出现运行占位卡片；卡片会明确提示此时发送新消息会取消本轮审查。完成后，同一位置原位更新为报告、静默、无关、中断或失败终态，多轮审查不会合并到会话末尾。报告正文复用 DSH 的 Markdown 渲染，支持 GFM、表格、代码块和 TeX，并保留官方的不安全内容过滤。

被接受的报告会成为 root Session 中持久化的用户消息并触发 follow-up，但该 relay 只更新触发位置的既有卡片，不再生成尾部卡片。`silent`、`not_relevant`、`aborted` 和 `failed` 都有可见卡片，但不会注入主 agent，因此不会由展示状态形成 Shadow 循环。

需要分析生产问题时，在对应定义中设置 `debug: true`。`$DSH_HOME/shadow-minds/logs/<shadow-id>.jsonl` 会按 run 记录准入、child 启动、取消请求、终态和报告投递，包含阶段、稳定原因码、取消来源与 provider stop reason。日志不记录 prompt、报告正文、工具参数、凭据、绝对路径或 stack；例如用户新消息取消为 `USER_MESSAGE_RECEIVED`，Shadow 超时为 `SHADOW_TIMEOUT`，无法归因给插件的 provider 中断为 `PROVIDER_ABORTED`。

## 安全与限制

默认轨迹投影会移除推理、原始工具结果文本和工具参数。用户及 assistant 文本中的 prompt injection 仍然可能进入投影，因此工具 allowlist、继承的 sandbox、固定的 child approval 策略和披露上限仍是必要的安全控制。

定义按一个 Harness home 全局生效，不按 profile 或 workspace 隔离。Child Session 遵循 Harness 的持久化策略。并发 Shadow 之间没有共享事务；一旦启用写入型工具，它们可能与 root 或其他 Shadow 发生竞争。

[技术方案](docs/technical-design.zh.md)包含 Pi 参考实现分析、DSH 架构、生命周期和有意保留的差异。提交日志或更新安装 commit 前请阅读 [SECURITY.md](SECURITY.md)。

## 开发

```sh
pnpm install
pnpm run check
```

`lib/` 是需要审查并提交的发布产物；源码行为变化时必须同步更新。禁止提交本地 Harness 状态、凭据、Session、日志或验收导出文件。
