---
name: shadow-debug
description: 定位 DeepSeek Harness Shadow Mind 插件运行问题。当用户提供一个子代理报错信息、子代理会话 id（childSessionId）、shadow runId 或根会话 id，需要查明那次 shadow 运行的日志、入参与 LLM/接口调用失败原因时使用此 skill。
version: 1.0.0
---

# Shadow Mind 问题定位（shadow-debug）

用户能提供的通常只有两类碎片：**子代理的报错文本**，或**子代理会话 id**（GUI 卡片、`list_agents`、报错文案里的 UUID，如 `e7d0b857-122d-4a8f-94eb-ed8c03c22695`）。本 skill 把碎片还原成完整现场：那次运行的调试时间线、入参、以及 LLM/工具调用层的失败原因。

## 核心工具

插件仓库自带零依赖 CLI：`<repo>/tools/shadow-debug.mjs`。本机仓库位于 `G:\AIwork\dsh-shadow-mind`（其它机器按克隆位置调整），用 Node 直接运行，无需安装：

```powershell
node G:\AIwork\dsh-shadow-mind\tools\shadow-debug.mjs <command> [options]
```

命令：`trace <id>`（追查单次运行）、`find <文本>`（按报错文本/原因码检索）、`runs [--failed] [--shadow <id>]`（列出运行）、`health`（体检 debug 开关与日志健康度）。通用选项 `--home <dir>`、`--sessions <dir>`、`--json`。DSH 会话内运行时会自动从 `$DSH_HOME`/`$DSH_SESSION_JSONL` 推断路径，一般无需传 `--home`。

## 标准定位流程

**第 1 步：体检（先确认有日志可查）**

```powershell
node G:\AIwork\dsh-shadow-mind\tools\shadow-debug.mjs health
```

- 目标定义的 `debug` 列必须是 `true`；否则没有运行日志 → 告诉用户开启定义里的 `debug: true`（或设置页开关）后复现。
- 注意“损坏记录”汇报：若存在 NUL 填充/截断行，说明历史上有写入中断或旧版本崩溃，可一并告知用户。

**第 2 步：按手头碎片选择入口**

- 有 **childSessionId / runId**：`trace <id>`。优先贴 childSessionId（最精确）；trace 会输出时间线、入参、子代理会话证据、根会话文件路径。
- 只有**根会话 id**（`session-` 前缀）：`trace <id>` 会列出该会话的所有 shadow 运行，再对目标 runId 精确 trace。
- 只有**报错文本**：`find "<文本片段或原因码>"`（如 `SHADOW_TIMEOUT`、`502`、`INVALID_STRUCTURED_OUTPUT`），从命中列表拿到 childSessionId/runId 后 `trace`。
- 没有任何 id：`runs --failed` 按时间倒序找最近的失败/中止运行。

**第 3 步：解读 trace 输出**（输出分四块）

1. **运行时间线**：`run-admitted → child-started → [run-cancellation-requested] → quality-metadata → run-finished → [report-*]`，每条带时间戳。
2. **本次运行入参**：定义文件路径、激活概率、模型路由与实际路由、预算档位、推理强度、超时、捕获窗口/上下文/thinkFirst、额外工具、审查提示词行数。
3. **子代理会话证据**：会话文件路径、持久化 descriptor（provider/label/agentModel/toolFilter）、prompt 长度与头部、事件计数、工具调用分布、工具错误（含 INVALID_ARGS）、turn 终止原因、LLM 请求头（provider/model/effort/maxTokens）、最后 N 条事件。
4. **根会话文件路径**与投影窗口 seq（`capturedThroughSeq` 之前的根轨迹就是 Shadow 的入参窗口）。

需要完整 prompt 时加 `--prompt`；需要更多尾部事件用 `--events <n>`。

## 原因码速查（翻译给用户）

- 取消类：`SHADOW_TIMEOUT`（超过定义超时）、`USER_MESSAGE_RECEIVED`（用户发新消息主动取消）、`USER_TURN_ABORTED`、`STALE_EPOCH`、`SHADOW_PAUSED`、`HEADLESS_*`、`PROVIDER_ABORTED`。
- 插件侧失败：`TRAJECTORY_BUILD_FAILED`（prepare，构建轨迹投影失败）、`MODEL_SELECTION_INVALID`、`SUBAGENT_START_FAILED`（start，启动子代理失败）、`SUBAGENT_RESULT_FAILED`（run，取结果失败）、`SUBAGENT_DISPOSE_FAILED`（dispose，回收失败）、`INVALID_STRUCTURED_OUTPUT`/`STRUCTURED_OUTPUT_MISSING`（validate，结构化输出缺失/非法）、`REPORT_DELIVERY_FAILED`（relay，报告投递失败）、`UNKNOWN_FAILURE`。
- 提供方类：`PROVIDER_ERROR`、`PROVIDER_MAX_TOKENS`、`PROVIDER_REFUSAL`、`PROVIDER_STOPPED` —— 此时必须继续看子代理会话里的 `turn/end` 原因与 `request/header`，确定是哪个 provider/model 的哪次请求失败。

阶段含义：`prepare`（投影/校验）→ `start`（启动）→ `run`（执行）→ `dispose`（回收）→ `validate`（校验输出）→ `relay`（投递报告）。时间线里最后一条 `stage=` 就是卡点阶段。

## 数据落点（工具不可用时的手动路径）

- 调试日志（元数据，无 prompt/报告正文/工具参数/凭证）：`$DSH_HOME/shadow-minds/logs/<shadowId>.jsonl`，每条含 `runId/childSessionId/rootSessionId/event/phase/stage/reasonCode/providerStopReason/error`。手动检索：`Select-String -Path "$env:DSH_HOME\shadow-minds\logs\*.jsonl" -Pattern "<文本>"`。
- 定义（入参）：`$DSH_HOME/shadow-minds/<shadowId>.md`（YAML frontmatter + 审查提示词）。
- 子代理完整事件流：`$DSH_HOME/sessions/<项目目录>/<childSessionId>/session.jsonl.zstd`（或 `.jsonl`）。注意 Node 的 `zstdDecompressSync` 对多帧拼接文件只解第一帧，必须按魔数 `28 B5 2F FD` 逐帧解码（工具已内置此逻辑；手动解码参考 `tools/decode-child-session.mjs` 的帧扫描写法）。
- 根会话：`$DSH_HOME/sessions/<项目目录>/<rootSessionId>/session.jsonl.zstd`。
- 价值循环元数据：`$DSH_HOME/shadow-minds/value-loop.jsonl`。

## 汇报规范

- 结论先给：这次运行在哪个阶段、以什么原因码终止、错误文本是什么。
- 引用文件路径时使用 `trace` 输出中的绝对路径。
- **不要把完整 prompt、system 文本、报告正文整篇粘贴进对话**；只摘录与失败相关的片段。子代理会话含用户敏感内容，默认只转述结构（事件计数/错误码/请求头）。
- 若日志里查不到该 id：先说明可能原因（该定义 `debug: false`；日志被清理；id 不是 shadow 相关），再建议 `health` + 复现时开启 debug。
