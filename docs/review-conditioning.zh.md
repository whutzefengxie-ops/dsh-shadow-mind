# Shadow Mind 审查条件机制

[English](review-conditioning.md) | 中文

本文定义全新 Shadow child 如何接收轨迹、运行时 context、模型路由、工具与可选规划步骤。这些控制作为逐定义数据保存在 `$DSH_HOME/shadow-minds/*.md`，默认值会保留普通定义的原行为。

## 定义字段

| Frontmatter | 运行时值 | 默认值 | 作用 |
|---|---|---|---|
| `capture` | `full` 或 `since-compaction` | `full` | 选择渲染进 prompt 的持久 root 日志视窗。 |
| `context` | `standard` 或 `minimal` | `standard` | 控制普通运行时 context 与 pre-step 消息继承。 |
| `think_first` | boolean | `false` | 在调查前增加一次无工具规划请求。 |
| `run_with_model` | 完整 `provider/model` 路由 | 继承 | 设置 child 模型。 |
| `reasoning_effort` | 非空 provider 值 | 继承 | 覆盖已解析 child 路由的 reasoning effort。 |

Registry、管理工具、Remote 数据与 Web 表单读写同一组字段。未知值会拒绝定义，而不会回退。

## Compaction-aware 截获

`capture: full` 投影 Session 开始到触发 `turn/end` 之间的可见事件。`capture: since-compaction` 查找该水位之前最近一次成功的 `compaction/end`，保留 compaction summary，并投影后续可见事件。渲染后的每条用户消息、assistant 消息、summary、工具调用和工具结果都携带持久 sequence。

投影排除 reasoning、原始工具结果正文与未来事件；它渲染确定性工具结果计数，并按 `argumentDisclosure` 处理工具参数。投影返回的 sequence 集合也是报告 `refs` 的 allowlist；引用已省略、未来、重复、无序、非正数或其他不可见 sequence 的报告无效。

Compaction-aware 截获会限制陈旧历史，但不会重建 compactor 已省略的信息。可见投影无法支持更强发现时，reviewer 必须返回 `gap` 或 `uncertain`。

## Minimal child context

`context: standard` 使用普通 child 组合。`context: minimal` 保留显式 Shadow prompt、persona、已选模型、delegated policy 覆盖、tool filter、结构化输出指令、Session descriptor 与生命周期元数据，同时抑制普通 runtime-context 章节和与本次审查无关的下游 pre-step 消息追加。

Minimal context 不是更弱的安全模式。Child 仍保留 parent 的显式 delegated policy 与 sandbox 约束，工具仍受请求 allowlist 限制。它可能移除有用的部署指令，因此按定义 opt-in。

## Think-first 执行

`think_first: true` 在两次请求中保持同一个 child、run id、模型选择、AbortSignal 与释放生命周期：

1. 第一次请求没有任何工具。Shadow prompt 要求给出编号计划，并指出准备 challenge 或验证的渲染 sequence。
2. 该 turn 收束后，provider 把插件来源的 continuation steer 到同一 child。
3. 第二次请求恢复已配置工具与 `structured_output` 工具。只有 schema 有效且已提交的调用才能成为 run 结果。

取消、超时、parent 释放或插件释放同时覆盖两次请求。仅有规划答案绝不会被接受为报告。`think_first: false` 保持普通单请求路径。

## Provider 能力契约

插件保留 subagent provider 名称 `shadow-mind`。内置 provider 声明支持结构化输出、深度限制、tool filter、persona、模型选择、context 继承与 think-first。它通过 parent 已发布的 agent factory 创建 child，并复用 DSH 的组合与策略原语，不修改宿主 loop。

如果其他插件先注册了 `shadow-mind`，本插件会保留该 provider。运行准备阶段只检查已解析请求实际需要的能力：带路由的运行要求 `modelSelection`，minimal context 要求 `contextInheritance`，think-first 要求 `thinkFirst`。缺失能力会在调用 provider `start()` 前使运行失败，绝不会隐式改变请求语义。

## Deliberation 遥测

Child 收束后，运行时计算第一个名称为 `structured_output` 的 Session `tool/call` 之前的 text 与 reasoning 流字符数，并把总数作为 `deliberationChars` 写入进程内状态与仅含元数据的诊断。如果没有该调用，则统计全部已记录 assistant chunk。启用 think-first 时，该计数包含规划输出。

这个值仅用于诊断，不影响激活、接受、severity、预算、冷却或 value-loop 分类。字符长度依赖 provider，也可能在不改进发现的情况下被优化。

## 验证

自动化覆盖会拒绝无效定义值与不可见 refs，并保持 registry、表单和投影语义。真实 `AgentLoop` 场景验证同一个条件化 child 先在无工具状态下规划，再使用已选模型与工具继续，返回结构化报告，把持久 provenance 转发给 root，并在释放后移除 child。
