# 设置页字段分级与简化方案

[English](settings-ux-analysis.md) | 中文

> **已被取代**：本文按多定义模型描述的第一轮分级方案已被 [`settings-ux-revamp.zh.md`](settings-ux-revamp.zh.md) 取代（单 Shadow 审查者 + 命令审查能力删除 + toast/滑杆/开关交互重构）。本页仅保留作历史记录。

本文分析 Shadow Mind 设置页（设置 → 插件 → Shadow Mind）的字段分级、创建失败根因与修复方式，并说明内置参考模板的设计。它是设置页改造的实现依据。

## 1. 问题

1. **创建 Shadow 经常失败**：错误为 `shadowMind.create failed: internal: holdout definition "…" needs <DSH_HOME>\shadow-minds\holdout-keys.json`。根因是创建/更新表单上的 `holdout` 复选框没有提示也没有配套管理入口：只要勾选，registry 就立即读取由操作方手工维护的 `holdout-keys.json` sidecar，缺失时以 `internal` 错误拒绝整个操作。
2. **信息过载**：全局设置 30 余项、单条定义 18 项全部平铺在一张表单里，没有区分必填、常用与高阶，用户无法判断从哪里开始。

## 2. 字段分级原则

分级不是为了删除能力，而是为了分层暴露：

- **必须项**：缺了它定义无效或无法使用，创建表单中必须填写。
- **基础项**：与调度开关、执行模型直接相关的常用项，常驻显示。
- **高阶项**：默认值即可正常工作的调优项，折叠在“高级”区域内。
- **不开放项**：需要 UI 之外的操作才能生效（例如手工维护的 sidecar 文件），从表单中移除，改为编辑定义文件启用，列表只读展示状态。

## 3. 定义字段分级（每条 Shadow）

| 字段 | 级别 | 理由 |
| --- | --- | --- |
| `id` | 必须 | 定义文件名与报告归属；创建后不可改。 |
| `name` | 必须 | 列表、卡片与诊断中的显示名。 |
| `prompt` | 必须 | Shadow 的审查职责，空值拒绝保存。 |
| `activation_probability` | 必须 | 调度概率，默认 `0.3` 有值但必须可见。 |
| `enabled` | 必须 | 决定是否参与调度。 |
| `run_with_model` | 基础 | 决定 Shadow 用哪个模型，最常见的执行调整。 |
| `reasoning_effort` | 基础 | 与模型配套的推理强度。 |
| `timeout_seconds` | 基础 | 常用成本控制。 |
| `think_first` | 基础 | 一次点击改变审查方式，README 推荐配置。 |
| `tools` | 基础 | 扩展只读工具 allowlist 的常见需求。 |
| `debug` | 高阶 | 生命周期 JSONL 诊断，排障时使用。 |
| `active_for_models` | 高阶 | glob 语法有学习成本；留空即全模型。 |
| `capture` | 高阶 | 默认 `full` 已满足多数场景。 |
| `context` | 高阶 | `minimal` 属于条件化高级用法。 |
| `pre_filter` / `boost_filter` / `boost_factor` | 高阶 | 具名谓词需要理解谓词库才能安全配置。 |
| `holdout` | 不开放 | 需要操作方手工创建 `holdout-keys.json`；表单无法管理该文件，勾选只会得到 opaque 错误。改为编辑 `.md` 文件加 `holdout: true` 并在 sidecar 中登记字面量。编辑已有定义时表单保留并透传原值，不会因保存而清除。 |

## 4. 全局设置分级

| 字段 | 级别 | 理由 |
| --- | --- | --- |
| `heartbeatProbability` | 基础 | 主开关；0 即关闭自动调度。 |
| `maxParallelShadows` | 基础 | 并发与成本的主旋钮。 |
| `defaultShadowTimeoutSeconds` | 基础 | 默认运行期限。 |
| `defaultShadowModel` | 基础 | 默认执行模型。 |
| `defaultReasoningEffort` | 基础 | 默认推理强度。 |
| `maxPromptChars` / `maxReportChars` | 高阶 | 上下文与回传上限，默认值即可用。 |
| `argumentDisclosure` | 高阶 | 隐私/能力权衡，默认 redacted 更安全。 |
| `preferIndependentVendor` | 高阶 | 陪审团独立性偏好。 |
| `longOutputBoostChars` 等提升/跳过阈值 | 高阶 | 与谓词库联动，默认值可用。 |
| `valueLoopEnabled` 及窗口 | 高阶 | 诊断统计。 |
| `reviewWindowSize` 与停滞检测系列 | 高阶 | 审查去重与冷却微调。 |
| `reasoningEffortLadder` | 高阶 | 升级阶梯。 |
| `sessionShadowSoftBudgetChars` / `sessionShadowHardBudgetChars` / `frugalShadowModel` | 高阶 | 预算路由，需三项联动。 |
| `staleReportDecay` | 高阶 | 重复报告衰减。 |
| `conflictSynthesisEnabled` / `conflictSynthesisTimeoutSeconds` | 高阶 | 冲突综合开关与期限。 |
| `resultBatchWindowMs` | 高阶 | relay 合并窗口。 |
| `headlessDrainTimeoutSeconds` | 高阶 | 仅 headless 进程使用的收敛期限。 |
| `randomSeed` | 高阶 | 复现调度用调试开关。 |

全局设置不设“不开放”项：保存协议需要完整的 resolved settings，隐藏字段会随表单草稿静默保留，反而造成“改了但看不见”的困惑。全部保留但折叠进“高级设置”。

## 5. 内置参考模板

设置页新增“参考模板”面板，内置六个模板：`contrarian`、`hacker`、`researcher`、`simplifier`、`architect`（来自 `examples/shadow-minds/`）和 `implementation-reviewer`（实现质量审查）。模板仅存在于客户端 bundle 中：

- 不写入定义目录、不参与调度（不激活）；
- 点击“使用模板”把 id、名称、激活概率、capture 与职责提示词预填进创建表单，仍须用户显式“创建”才落盘；
- 目标 id 已存在同名定义时按钮禁用，避免“已存在”报错。

模板职责提示词沿用仓库内置 persona 的审查规则：只报告轨迹可支持的、值得采取行动的问题；证据不足时标注 evidence gap；报告必须带当前轨迹中真实渲染的序号引用。

## 6. holdout 修复

1. 创建/编辑表单移除 `holdout` 复选框；`DefinitionDraft` 仍保留该字段用于编辑透传，新建始终为 `false`。Web 界面从此无法触发“缺少 sidecar”的失败路径。
2. `ShadowRegistry.holdoutKeys` 的缺失文件报错改为可操作信息：给出 sidecar 绝对路径、期望的 JSON 形状（`{"<id>": ["<literal>", …]}`），并提示“作为操作方创建该文件，或从定义中移除 `holdout: true`”。
3. 定义列表与诊断面板继续只读展示 holdout 状态与缺失 sidecar 的文件级诊断。

## 7. 实现清单

- `docs/settings-ux-analysis.md` / `.zh.md` / `.i18n.yaml`：本方案。
- `src/client/templates.ts`：内置模板数据。
- `src/client/ShadowMindSettingsTab.tsx`：分组表单、模板面板、holdout 复选框移除。
- `src/client/locales.ts`：新增分组、模板与操作提示文案（中英）。
- `src/client/ShadowMindSettingsTab.module.css`：分组、折叠与模板卡片样式。
- `src/runtime/registry.ts`：holdout sidecar 缺失时的可操作报错。
- `tests/templates.spec.ts`：模板数据与预填转换的自动化覆盖。
