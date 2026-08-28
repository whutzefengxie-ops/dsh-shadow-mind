# Shadow Mind 审查质量方向

[English](review-quality-directions.md) | 中文

本文定义从 ouroboros 谱系适配到插件现有 fresh-child scheduler 的八项审查质量机制。**注意**：其中 D2（确定性谓词）与 D6（冲突综合）已随产品收敛移除，见 [`settings-ux-revamp.zh.md`](settings-ux-revamp.zh.md)；命令审查能力亦已整体移除。保留项使用经过验证的定义字段、settings、持久 Session 事件与有界进程内元数据，不安装另一套 workflow engine。

## D1：Probe-class 类库

`PROBE_CLASSES_V1` 是失败工具调用、已脱敏参数、陈旧读取、误导性成功、重复失败与长输出的单一事实来源。每个 class 都有稳定 id、名称、触发条件与具体 probe，`renderProbeChecklist()` 生成可复用 prompt block。

[`examples/shadow-minds/`](../examples/shadow-minds/) 中默认禁用的定义把这些 probe 与 `architect`、`contrarian`、`hacker`、`researcher` 和 `simplifier` persona 组合起来，并作为设置页「审查风格预设」的数据源。它们要求在 probe 不可观察时报告 evidence gap，并在生成报告时提供 anchored refs。安装过程绝不会启用这些定义或把它们复制到 `$DSH_HOME`。

## D2：确定性谓词（已移除）

~~定义通过 `pre_filter` 选择 skip 谓词，通过 `boost_filter` 选择 boost 谓词；未知 id 会拒绝定义。Skip 谓词为 `last-report-covers`、`tool-failure` 与 `no-tool-calls`，boost 谓词为 `misleading-success`、`repeated-failure` 与 `long-output`。~~

~~Boost 在抽样前用 `boost_factor` 放大激活概率，并把结果限制为一。Skip 在候选选中后、child 创建前执行。两条路径都只检查持久事件，不产生模型请求；状态公开有效概率与累计 skip 数。~~

谓词库（`prefilter.ts`）与全部预/提升谓词配置已删除：单一 Shadow 模型下调度只做一次概率判定，不需要谓词微调。

## D3：Anchored 报告 envelope

报告要求非空 `content`、值为 `challenge`、`gap`、`confirm` 或 `uncertain` 的 `verdict`、零到一之间的可选有限数 `severity`，以及可选 `refs`。Refs 必须是最多八个正安全整数构成的升序唯一列表，并且每项都存在于确切投影中。`silent` 与 `not_relevant` 要求空 content，并拒绝所有 envelope 字段。

Relay 章节按 severity 降序排列。持久 provenance 携带 verdict、refs 与可选 severity；路由与 vendor 分类只保留为进程内诊断。

## D4：停滞与新颖性

有界审查窗口只保留 envelope 元数据，绝不保留报告文本。它检测相同 envelope 重复形成的 spinning、相同 refs 上 verdict 交替、重复不变 confirmation，以及已配置视窗内 novel envelope 比例过低。

检测只选择一种协调动作。启用 oscillation 提升且存在更高的已配置 `reasoningEffortLadder` 值时，它会为一次运行预留该值而不安装冷却；否则会安装 `cooldownUntil`。真实用户消息会重置冷却、待处理提升与陈旧衰减；headless 运行依赖墙钟到期。

## D5：Reviewer 独立性

已知 provider 前缀与 model marker 映射到 vendor family。解析后的关系为 `independent`、`same_vendor`、`unverified` 或 `unavailable`；未知路由绝不表示独立。路由与关系出现在终态状态和仅含元数据的诊断中。

~~`preferIndependentVendor` 默认关闭。开启后，只有至少两个非 same-vendor 候选仍存在时才移除 same-vendor 候选，从而保留可用审查集合，而不是用单一 reviewer 声称纯度。~~（多候选陪审团设置已随单 Shadow 模型移除；独立性分类仍用于报告展示。）

## D6：冲突综合（已移除）

~~一个已接受批次内，`challenge` 与 `confirm` 的 refs 重叠或任一方没有 anchor 时构成冲突。每批最多选择一个 pair：severity 差最小者优先，随后选择合计 severity 最大者。综合默认关闭，并要求存在已启用且 id 为 `synthesizer` 的定义。~~

~~全新 synthesizer child 只接收两个已脱敏报告文本、各自 envelope 元数据与 synthesizer 指令，不拥有普通工具。有效的 `challenge`、`gap` 或 `confirm` 报告会替换该 pair，使用较弱输入的 severity，并记录两个原 run id。Relay 会明确说明综合只使用报告文本，没有重新验证。~~

~~定义查找、holdout sidecar 读取、prompt 构造、硬预算检查、输出校验、provider 执行、超时与释放都会失败开放：两个原报告仍可参与 relay，运行时记录仅含元数据的诊断。取消或 epoch 改变会丢弃陈旧待投递批次，而不是把它转发进较新的 root 状态。~~

冲突综合（`synthesis.ts`）与相关设置已整体删除：单一 Shadow 不存在「多个审查者互相冲突」的场景。

## D7：Holdout 纪律

定义通过 `holdout: true` 选择加入。其唯一、非空的精确 literal 来自操作方管理的 `$DSH_HOME/shadow-minds/holdout-keys.json`；缺失、格式错误、空值或重复 key 会拒绝操作。插件不会写入该 sidecar，也不会管理其访问控制，因此部署必须把访问权限限制到运行 Harness 的操作系统账户。Key 不进入定义、管理数据、表单、状态、provenance 或诊断。

字面替换覆盖投影轨迹、封装 reviewer prompt、已接受报告与 root relay。持久化前的最终 invariant 会检查 owner 已知 literal。它只保护插件自有模型可见路径上的精确字符串，不限制 filesystem 读取、不改变 child Session 持久化，也不检测转述。

## D8：Session 预算与陈旧报告衰减

每 root 的 `spentChars` 统计最近一次真实用户消息之后已准入 prompt 与已接受报告的字符数。软上限要求同时配置更大的硬上限与 `frugalShadowModel`；达到软上限后，后续符合条件的工作路由到该模型。达到硬上限后停止新的 reviewer 工作，但不取消已准入 child。状态报告 `standard`、`frugal` 或 `exhausted`。

当一个定义重复已接受 envelope 时，其后续激活概率乘以 `1 - staleReportDecay`。默认值零会禁用衰减。真实用户消息会同时重置消耗、衰减与协调状态。

## 诊断 value loop

每个已接受 `challenge` 可以观察后续 `valueLoopWindowTurns` 个已完成 root turn。持久 assistant 用语与工具目标把它分类为 `challenge_adopted`、`challenge_rejected` 或 `ignored`。进程内计数公开分类与显式处置命中率；`value-loop.jsonl` 保存元数据，不含报告或轨迹文本。新建 POSIX 路径会为目录请求 `0700`、为 journal 请求 `0600`；既有权限与 Windows ACL 由部署负责。

分类器是没有控制权威的启发式机制。其输出绝不改变调度、预算、冷却、verdict 或报告投递。

## 验证

自动化覆盖会拒绝无效 probe、envelope、定义、settings 与 holdout 数据，并固定各项协调结果。生命周期和完整组装场景验证完整 relay 脱敏、取消、持久 anchored provenance、同一 child 的 think-first 执行与完全停稳的 teardown；单 Shadow 语义（旧定义永不参与调度）亦有专门测试。
