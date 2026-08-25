# Shadow Mind 目标架构

[English](target-architecture.md) | 中文

本文说明独立版本化组合包 `@whutzefengxie-ops/dsh-shadow-mind` 已实现的架构。该组合包通过 DeepSeek Harness 的公开插件、Session、subagent、settings、tool、Typert 与客户端扩展点安装；它不修改 Harness 仓库或 `agent-loop`。

## 运行时拓扑

包根入口提供运行时，`./tool` 提供管理工具与 `/shadow`，`./client` 提供浏览器集成，`./typert` 提供生成的 Remote 描述，`cordis.patch.yml` 提供 profile 组合。运行时定义位于 `$DSH_HOME/shadow-minds/*.md`；[`examples/shadow-minds/`](../examples/shadow-minds/) 中默认禁用的 starter 定义只是包内容，绝不会被自动复制或启用。

运行时划分为五项职责：

1. 触发路径负责识别符合条件的工具轮次、heartbeat 探索、定义过滤、激活概率、衰减、冷却、提升、vendor 偏好、并发与 Session 字符预算。
2. 运行路径负责轨迹截获、context 继承、think-first 执行、模型选择、工具限制、策略继承、超时、取消与全新 child 的释放。
3. 输出路径负责结构化结果截获、`verdict`、`severity`、`refs`、报告校验、holdout 替换、批次排序与持久 relay provenance。
4. 协调路径负责有界审查元数据、停滞检测、单 pair 冲突综合、替换 provenance 与确定性 fail-open 行为。
5. 治理路径负责进程内状态、anchored Web 卡片、本地诊断 journal、value-loop 分类与完全停稳的 teardown。

[条件机制参考](review-conditioning.zh.md)定义 `capture`、`context`、`think_first` 与 `deliberationChars`；[质量机制参考](review-quality-directions.zh.md)定义叠加在 scheduler 上的 D1–D8 机制。

## Anchored 审查模型

每次准入的 Shadow 都是全新 child，并带有明确的 root 事件水位。渲染后的每个轨迹条目携带持久 Session sequence，报告只能引用其确切投影中存在的 sequence。该保证产生 anchored 发现，但不能证明已省略数据、不可访问产物或隐藏 reasoning。

报告使用四种认识论 verdict：`challenge`、`gap`、`confirm` 或 `uncertain`。可选 `severity` 只在一次 relay 内排序并打破综合平局，不是可跨 provider 比较的质量分数。`refs` 是最多八个可见正整数 Session sequence 组成的升序唯一列表。

已接受报告成为普通持久 `user/message`，并携带 `shadow-report` provenance。Provenance 记录定义、run、child Session、截获水位、verdict、refs、可选 severity 与可选综合替换 id。运行中、安静、无关、中断和失败状态保留在进程内，并更新锚定到被审查 `turn/end` 的卡片；它们不会创建自定义 Session 事件或模型可见伪报告。

## 专用 child provider

运行时通过 provider 名称 `shadow-mind` 启动 reviewer 与可选 synthesizer。该名称空闲时，插件使用 DSH 已发布的 child 创建、策略继承、模型选择、tool、system prompt、Session 与释放 API 注册自己的进程内 provider。每次运行创建一个全新 child，provider 负责 prompt、AbortSignal 交接、结果收束与完全停稳的释放。

部署可以预先注册同名 provider，插件不会覆盖它。每次请求前，运行时按本次请求检查 `modelSelection`、`contextInheritance` 与 `thinkFirst` 能力；provider 无法保留所需语义时，该运行会明确失败。条件机制绝不会静默降级为普通 spawn 行为。

## 消耗、协调与取消

具名 skip 与 boost 谓词无需模型调用即可检查持久事件。审查窗口检测可以安装墙钟冷却，或预留高一档的已配置 reasoning effort。Prompt 与已接受报告字符按 root 累积：达到可选软上限后选择节省路由，达到硬上限后阻止新的 reviewer 与综合工作，但不取消已准入工作。

冲突综合是可选功能，每个 relay 批次最多处理一对 refs 重叠的 `challenge`／`confirm`。有效综合替换该 pair，并记录两个原 run id。配置、prompt、预算、provider、输出、超时与释放失败会转发原报告；epoch 改变则使整个待投递批次失效，陈旧原报告会标记为 aborted，不会投递给已经前进的 root。

真实用户输入、用户取消 turn、暂停、root 释放、插件释放或 headless 取消都会推进 owner epoch。活动 child 与综合任务收到取消，batcher 中仍待投递的已验证报告转换为 relay 阶段的 aborted 终态。进入 inbox 前，投递路径会再次核对准确的 root 身份与 epoch。

## 安全与诊断权威

投影会移除 reasoning 与原始工具结果正文，默认也会脱敏工具参数。投影中的用户与 assistant 文本仍可能包含 prompt injection，因此工具 allowlist、继承的 sandbox 策略与固定 delegated approval 行为仍是强制控制。

Holdout 模式使用操作方妥善保护的 `$DSH_HOME/shadow-minds/holdout-keys.json` 执行精确字面替换。插件会校验数据，但文件权限与 Windows ACL 由部署负责。它覆盖插件自有的模型可见路径和完整 relay invariant，但不是 filesystem sandbox，也不能检测转述。Child Session 继续遵循 Harness 的普通持久化策略。

生命周期 debug 文件与 `value-loop.jsonl` 只含元数据，不含轨迹或报告文本。Value-loop 分类描述后续持久活动是否看似采纳、拒绝或忽略 challenge；它绝不调整概率、把关报告、奖励模型或改变调度。

## 实现与验证

运行时编排位于 `src/runtime/`，管理能力位于 `src/tool/`，浏览器设置与 anchored 卡片位于 `src/client/`，starter persona 位于 `examples/shadow-minds/`。自动化覆盖会验证各项独立机制及其失败场景。完整组装的 `AgentLoop` 场景会加载 starter 定义，并验证 root 工具调用、同一 child 的 think-first continuation、minimal context、模型路由、结构化输出、持久 relay provenance、follow-up 与释放。
