# Shadow Mind 问题快速定位指南

> 场景：Shadow 插件运行出现问题时，手头通常只有两块碎片——**子代理报错文本**，或**子代理会话 id**（childSessionId）。本文档说明如何用 `tools/shadow-debug.mjs` 把碎片还原为完整现场：该次运行的调试时间线、入参，以及 LLM/工具调用层的失败原因。

## 1. 两个入口

| 手头有什么 | 第一步命令 | 说明 |
| --- | --- | --- |
| childSessionId（如 `e7d0b857-122d-4a8f-94eb-ed8c03c22695`） | `node tools/shadow-debug.mjs trace <id>` | 最精确，直接命中该次运行 |
| shadow runId（如 `b7a03b95-eb7a-4b84-82fe-d5f47c973a50`） | `node tools/shadow-debug.mjs trace <id>` | 同上 |
| 根会话 id（`session-` 前缀） | `node tools/shadow-debug.mjs trace <id>` | 命中多次运行时先列出候选，再 trace 具体 runId |
| 报错文本 / 原因码（如 `502`、`SHADOW_TIMEOUT`） | `node tools/shadow-debug.mjs find <文本>` | 反查命中运行列表，再 trace |
| 什么都没有 | `node tools/shadow-debug.mjs runs --failed` | 按时间倒序列出失败/中止运行 |
| 不确定日志是否开启 | `node tools/shadow-debug.mjs health` | 检查各定义 debug 开关、日志大小、损坏行 |

在 DSH 会话内运行时，`$DSH_HOME` 与 `$DSH_SESSION_JSONL` 环境变量已存在，工具自动推断路径，无需 `--home`/`--sessions`。非 DSH 环境可用 `--home <dir>`、`--sessions <dir>` 显式指定。

## 2. trace 输出的四个部分

1. **运行时间线**：按时间排列 `run-admitted → child-started → [run-cancellation-requested] → quality-metadata → run-finished → [report-delivered/report-delivery-failed]`。最后一条 `stage=` 即卡点阶段，`reasonCode`/`providerStopReason`/`error` 给出终止解释。
2. **本次运行入参**：定义文件路径、名称、debug/启用状态、激活概率、适用模型、配置路由与实际路由（`quality-metadata.route`）、预算档位（`standard/frugal`）、推理强度、独立性（`same_vendor` 等）、超时、捕获窗口/上下文/thinkFirst、额外工具、审查提示词行数。
3. **子代理会话（LLM/接口调用证据）**：会话文件路径、session 头（parent/origin/depth/cwd）、持久化 descriptor（provider、label `shadow:<id>`、agentModel、toolFilter）、prompt 长度与头部（`--prompt` 输出全文）、事件计数、工具调用分布、工具错误（含 `INVALID_ARGS` 参数拒绝）、turn 终止原因、LLM 请求头（provider/model/reasoningEffort/maxTokens/toolCount）、最后 N 条事件（`--events <n>` 调整）。
4. **根会话文件路径**：`capturedThroughSeq` 之前的根轨迹即该次 Shadow 的入参窗口，可人工回溯。

`--json` 输出机器可读结构，便于脚本化。

## 3. 速查表

### 3.1 阶段（stage）

| stage | 含义 | 该阶段失败时的 reasonCode |
| --- | --- | --- |
| `prepare` | 读取定义、构建轨迹投影、校验能力 | `TRAJECTORY_BUILD_FAILED`、`MODEL_SELECTION_INVALID` |
| `start` | 启动子代理 | `SUBAGENT_START_FAILED` |
| `run` | 子代理执行中（含等待结果） | `SUBAGENT_RESULT_FAILED` |
| `dispose` | 回收子代理 | `SUBAGENT_DISPOSE_FAILED` |
| `validate` | 校验结构化输出/报告 | `INVALID_STRUCTURED_OUTPUT`、`STRUCTURED_OUTPUT_MISSING`、`INVALID_REPORT` |
| `relay` | 投递报告到根会话 | `REPORT_DELIVERY_FAILED` |

### 3.2 原因码（reasonCode）

| 类别 | 原因码 | 含义 |
| --- | --- | --- |
| 主动取消 | `USER_MESSAGE_RECEIVED` | 用户发送新消息，主动取消本轮审查（正常） |
| | `USER_TURN_ABORTED` | 根会话本轮被中止 |
| | `SHADOW_PAUSED` | Shadow 调度被暂停 |
| | `ROOT_DISPOSED` / `PLUGIN_DISPOSED` | 根会话/插件被销毁 |
| | `SHADOW_TIMEOUT` | 超过定义超时（默认 10 分钟） |
| | `HEADLESS_DRAIN_TIMEOUT` / `HEADLESS_MAINTENANCE_ABORTED` | 无头模式相关 |
| | `STALE_EPOCH` | 新一轮用户输入使本次运行过期 |
| | `PROVIDER_ABORTED` | 提供方中止，无法归因给插件 |
| 插件侧失败 | `SCHEDULING_FAILED` | 调度失败（未准入运行） |
| | `TRAJECTORY_BUILD_FAILED` | prepare：构建轨迹投影失败 |
| | `MODEL_SELECTION_INVALID` | 模型路由/强度选择非法 |
| | `SUBAGENT_START_FAILED` | start：子代理启动失败 |
| | `SUBAGENT_RESULT_FAILED` | run：读取子代理结果失败 |
| | `SUBAGENT_DISPOSE_FAILED` | dispose：回收失败 |
| | `INVALID_STRUCTURED_OUTPUT` | validate：结构化输出不合 schema |
| | `STRUCTURED_OUTPUT_MISSING` | 未调用 `structured_output` 工具 |
| | `INVALID_REPORT` | 报告正文非法 |
| | `REPORT_DELIVERY_FAILED` | relay：报告投递失败 |
| | `UNKNOWN_FAILURE` | 未归类失败 |
| 提供方 | `PROVIDER_ERROR` | LLM 提供方报错（看子代理会话里的具体错误） |
| | `PROVIDER_MAX_TOKENS` | 输出/上下文超 token |
| | `PROVIDER_REFUSAL` | 模型拒绝 |
| | `PROVIDER_STOPPED` | 非预期停止 |

### 3.3 症状 → 证据位置

| 症状 | 首先看 | 其次看 |
| --- | --- | --- |
| 超时/卡死 | 时间线 `run-cancellation-requested` 与 `SHADOW_TIMEOUT` | 子代理最后 N 条事件（它在做什么）、`deliberationChars`（是否长时间思考） |
| LLM 报错（5xx/429/超时） | 时间线 `error` 与 `providerStopReason` | 子代理 `turn/end` 的 `reason`、`request/header`（哪个 provider/model/effort）、`llm/retry` 次数 |
| 没有报告 | `STRUCTURED_OUTPUT_MISSING` / `INVALID_STRUCTURED_OUTPUT` | 子代理 `tool/call` 分布（是否调用 `structured_output`）、`INVALID_ARGS` 次数（schema 被拒后模型是否重试成功） |
| 报告没进根会话 | `REPORT_DELIVERY_FAILED`、`relayed=false` | 时间线 `report-delivery-failed` 记录 |
| 入参疑云（路由/工具/窗口不对） | `本次运行入参` 块 | 定义文件 frontmatter、子代理 descriptor 的 `toolFilter`/`agentModel` |
| 子代理根本没启动 | `SUBAGENT_START_FAILED`、无 childSessionId | 时间线 `error` 详情（能力缺失/路由非法） |

## 4. 数据落点

| 内容 | 路径 | 格式 |
| --- | --- | --- |
| 定义（入参） | `$DSH_HOME/shadow-minds/<shadowId>.md` | YAML frontmatter + 审查提示词 |
| 运行调试日志 | `$DSH_HOME/shadow-minds/logs/<shadowId>.jsonl` | 每行一条 JSON 元数据记录（无 prompt/报告/工具参数/凭证/路径/stack） |
| 子代理完整事件流 | `$DSH_HOME/sessions/<项目目录>/<childSessionId>/session.jsonl.zstd` | zstd 多帧拼接 JSONL（或 `.jsonl` 明文） |
| 根会话事件流 | `$DSH_HOME/sessions/<项目目录>/<rootSessionId>/session.jsonl.zstd` | 同上 |
| 价值循环元数据 | `$DSH_HOME/shadow-minds/value-loop.jsonl` | 每行一条挑战处置元数据 |

> 会话文件的 zstd 是多帧拼接：Node 的 `zstdDecompressSync` 整缓冲解压只会得到第一帧，必须按魔数 `28 B5 2F FD` 逐帧解码。`tools/shadow-debug.mjs` 已内置逐帧解码；手动解码参考 `tools/decode-child-session.mjs`。

## 5. 常见特殊情形

- **查不到 id**：目标定义 `debug: false`（`health` 确认）；日志被清理；该 id 不是 shadow 相关（工具会提示替代路径）。
- **没有日志文件**：定义未开 debug，或从未运行。开启后复现一次即可。
- **日志含损坏行**：`health` 会汇报 NUL 填充/截断行——历史写入中断或旧版本崩溃的痕迹；工具对可修复的截断行自动补齐解析并标注“截断修复”。
- **`run-admitted` 缺失**：旧版本日志（无 `schemaVersion`）或按 child id 检索时被合并逻辑自动补全，不影响结论。
- **子代理会话文件缺失**：会话尚未落盘、会话根目录配置不同（用 `--sessions` 指定）或已被清理。

## 6. 安全注意

- 子代理会话与根会话文件包含完整 prompt、代码内容与用户敏感信息。**只向他人转述结构**（事件计数、错误码、请求头、时间线），不要整篇粘贴。
- 调试日志本身只含元数据，可安全转发。
- 汇报时引用 `trace` 输出的绝对文件路径，方便接收方自行复查。

## 7. 会话内 skill

DSH 会话内可直接说“用 shadow-debug skill 定位这次 shadow 问题”，agent 会按 [`.agents/skills/shadow-debug/SKILL.md`](../.agents/skills/shadow-debug/SKILL.md) 的流程执行同样的定位步骤并按规定格式汇报。
