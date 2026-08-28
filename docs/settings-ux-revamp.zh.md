# 设置页重构与产品收敛方案（单 Shadow 审查者）

[English](settings-ux-revamp.md) | 中文

本文基于最新一批用户投诉，对 Shadow Mind 的设置页与调度模型做第二轮收敛：产品从「多 Shadow 陪审团 + 命令审查」收敛为**一个 Shadow 审查者**单一能力，并重做交互。文中标注了实施结果；取代 `settings-ux-analysis.md` 中仍按多定义模型描述的部分。

> **实施状态（代码完成；服务端 live 验收通过，仅剩客户端渲染确认）**：运行时、工具面、客户端、测试与文档已全部按本方案落地并通过 `pnpm run check`。要点：单一 `default` 定义自动创建（旧定义只读保留、概率默认 70%、默认超时 600 秒）；管理面 `catalog` 幂等确保 `default.md`，全新安装打开设置页即有可编辑卡片（修复空态误报「无法读取 Shadow Mind 数据」）；多定义 CRUD API 删除；`synthesis.ts`、`prefilter.ts` 与 `command-gate.ts` 整体删除；设置页重构为单 Shadow 卡片 + toast + 概率滑杆（10%–100%、步进 10%、默认 70%）。**live 验收进度**：harness 已重启并用新构建运行——会话工具面四项（`list_shadows`/`update_default_shadow`/`get_shadow_config`/`update_shadow_config`）已生效，`get_shadow_config` 读到默认超时 `600`、无任何已删键，`list_shadows` 显示 `default` 已自动创建（概率默认 0.7，用户可经设置页滑杆改，如 0.8 已落盘）、旧 `implementation-reviewer` 只读保留不再调度、diagnostics 为空；新 `lib/` 已部署进 live profile（历次备份见下文）。**唯一未完成项**：用户在浏览器 Ctrl+F5 后确认超时字段渲染出占位符 `600` 与「留空使用全局默认值：600 秒（10 分钟）。」——通过前，对应 PR 应保持 draft / 不合并。

> **超时根因与有效性证据**：旧构建（默认超时 300s）的 `implementation-reviewer.jsonl` 中，所有 `SHADOW_TIMEOUT` 都恰好在启动后 **300s** 触发（5 处，如 14:39:02→14:44:02），而成功完成的运行时长多在 **150–294s**——说明超时是**预算耗尽**（恰好撞 300s 顶），而非 provider 挂起或队列停滞。新构建（默认 600s）的 `default.jsonl` 已记录 **6 次成功运行**（66s、122s、124s、160s、165s、180s），**零次超时**。600s 提供了额外余量、已直接缓解该成因；若未来某次真正耗时的审查仍超过 600s，会在日志以 600s 顶触发，届时再评估是否上调。

## 1. 反思：反馈背后的根因（举一反三）

用户投诉的六条只是表象，背后有五类根因。方案必须解决根因，而不是只挪位置：

1. **反馈当内容、状态当页面**。保存/异常提示渲染在页面顶部的 `<p role="status">` 里，滚动即丢失，用户永远不知道操作是否成功。根因是插件没有「事件通知」通道；宿主 apps/web 也没有可复用的 toast 组件，插件必须自建。同类问题还有：全局设置与命令审查各有一个「保存」按钮，两处共享同一份草稿——任一按钮保存都会把另一处的未保存修改一起落盘，反馈语义混乱。另外，命令审查的数值字段藏在全局高级折叠里，与命令审查卡片分离，同一能力散落两处。
2. **开发者指标当用户内容**。会话状态面板平铺 15+ 个运行时指标（epoch、prefilterSkips、budgetTier、spentChars、synthesisRuns、cooldowns、pendingEscalations、recentReviews……），对用户无意义。用户只关心三件事：能力开没开、概率多少、最近审查结果如何。
3. **双重概率旋钮**。当前「启动概率」是两层抽奖：全局 `heartbeatProbability`（默认 33%）× 每个定义的 `activationProbability`（默认 30%），综合触发率约 10%，用户无法推算。用户想要的语义是单一的「每轮触发概率」，默认 70%。单 Shadow 化之后这层复杂度应当彻底消失。
4. **控件直出 schema 枚举**。布尔用 true/false 下拉、枚举直接显示 `root-only`/`deny`/`redacted` 等内部值、字段名 camelCase 当 label——都是「表单直接映射配置对象」的产物，没有按人类决策形状选控件、没有按受众选文案。
5. **能力边界不清**。Shadow 审查与命令审查是两个能力，却共用一份设置 schema 和两处各自保存的表单，用户分不清哪个开关管什么。定义列表、模板面板、诊断面板与设置并列，没有主次。

在此基础上举一反三，另有五类「用户没明说但同样要修」的问题：

6. **错误信息不可理解**。远程错误直接抛出 `shadowMind.create failed: internal: holdout definition … needs <DSH_HOME>\shadow-minds\holdout-keys.json` 这类内部话术，用户既看不懂也无法行动。需要错误码 → 人话映射 + 可操作建议。
7. **迁移兼容**。砍掉多 Shadow、合成、谓词后，磁盘上已有的多定义文件、已保存的旧设置怎么办。schemastery 的 `z.object` 默认剥离未知键，旧设置安全降级；定义文件保留不删，UI 只管理一个默认定义。
8. **工具面与 `/shadow` 命令同步**。agent 工具与 `/shadow` 状态输出里同样暴露被砍概念（prefilter skips、synthesis 统计），不改会造成「界面说没有、工具说有」的分裂。
9. **文档与示例同步**。`target-architecture`、`review-conditioning`、`examples/` 等多处描述多 Shadow 陪审团与谓词库，不改会继续误导用户。
10. **可访问性**。滑杆要有键盘 ±10%、数值气泡与 aria 语义；开关用 `role="switch"`；toast 用 `aria-live`。
11. **命令审查能力自身可靠性**。实施期间实测发现：命令闸门法官链路在真实环境中容易卡死（法官子代理挂起 → 并发槽位永久占用 → 后续所有受管命令在队列中被打断，`command gate judge wait aborted`），一个易故障的裁决器比没有裁决器更糟。据此追加决定：**整体删除命令审查能力**（含确定性 deny/allow 模式、法官、设置与统计），而不只修法官。

## 2. 优化点总览

| # | 来源 | 优化点 | 方案要点（含实施结果） |
| --- | --- | --- | --- |
| 1 | 反馈 1 | 通知 toast 化 | 右下角固定、线性堆叠 toast（成功/错误/信息），自动消失；顶部 message 移除 ✅ |
| 2 | 反馈 2a | Shadow 能力开关 | 卡片级 Switch，明确「开/关」 ✅ |
| 3 | 反馈 2b | 概率单滑杆 | range 10%–100%、步进 10%、默认 70%，替代心跳 × 定义双概率 ✅ |
| 4 | 反馈 2c | 默认 agent 入高级 | 运行模型选择移入高级折叠（留空=继承主 agent）；全局 defaultShadowModel/defaultReasoningEffort 直接删除 ✅ |
| 5 | 反馈 3 | 砍多 Shadow 讨论 | 定义列表/创建/删除/模板面板移除，单 Shadow 卡片；调度单判定；删除冲突合成与相关设置 ✅ |
| 6 | 反馈 4 | 控件人文化 | 布尔 → Switch；label 全部中英人话 ✅ |
| 7 | 反馈 5 | 命令审查独立能力 | **追加决定：能力整体删除**（命令闸门易卡死且用户无感知），不再保留第二张卡片 ✅ |
| 8 | 反馈 6 | 删除谓词配置 | 定义级 preFilters/boostFilters/boostFactor 与全局长输出/重复报告/重复失败阈值全部移除，运行时谓词库删除 ✅ |
| 9 | 举一反三 | 保存语义统一 | 整页单一「保存」动作 + toast「已保存并生效」 ✅ |
| 10 | 举一反三 | 错误文案人话 | 错误码 → 人话映射表 + 可操作建议，进 toast ✅ |
| 11 | 举一反三 | 状态面板精简 | 只保留「最近一次审查结果与时间」，其余指标全部移除 ✅ |
| 12 | 举一反三 | 迁移兼容 | 旧设置键安全忽略（schemastery 宽松透传、新运行时不再读取）；磁盘旧定义只读保留；default.md 自动创建时继承第一个旧定义的名称/职责、概率统一 70% ✅ |
| 13 | 举一反三 | 工具面收敛 | 删除 create/update/delete/enable/disable_shadow；新增 update_default_shadow；`/shadow` 输出精简 ✅ |
| 14 | 举一反三 | 文档与可访问性 | 文档同步 + 键盘/aria 支持 ✅ |

## 3. 具体方案（与实施结果一致）

### 3.1 通知 toast 化

- 新建 `src/client/ToastStack.tsx`：右下角 fixed 容器；每条 toast `{ id, kind, text }`，线性堆叠（新 toast 置顶）；成功 3s、错误 6s 自动消失，可手动关闭；`role="status"/"alert"` + `aria-live`。
- 设置页移除顶部 `message` 渲染，所有加载失败、保存成功、异常都走 `push(kind, text)`。
- `friendlyError(error, t)` 对已知错误输出人话 + 下一步建议。

### 3.2 信息架构：单一能力卡片

页面只保留一张 **Shadow 审查**卡片：开关、概率滑杆、审查风格预设下拉、名称、职责提示词、高级折叠（运行模型、超时、额外工具、轨迹截取、上下文继承、先思考再调查、调试记录）。卡片内展示「最近一次审查：结果 · 时间」状态行。移除：会话状态大面板、定义列表、创建/编辑/删除面板、模板面板（改为 prompt 预设下拉）、命令审查区块、诊断面板（仅在有文件诊断时显示一条警告行）。旧定义文件以只读提示行呈现。

### 3.3 概率单滑杆

- 新建 `ProbabilitySlider`（`src/client/controls.tsx`）：`<input type="range" min="10" max="100" step="10">` + 数值气泡 + 键盘 ±10% + aria 语义。
- 运行时删除 `heartbeatProbability`；新增 `DEFAULT_ACTIVATION_PROBABILITY = 0.7`；调度单次判定 `shouldRunShadow(probability, random)`。
- 迁移：`default.md` 自动创建时概率统一 0.7（含从旧定义继承场景）。

### 3.4 控件人文化

- 新建 `Switch`（`role="switch"` + `aria-checked`）替换全部布尔下拉。
- 所有 label/hint 走 locales（中/英人话），不再直接显示 camelCase key 或原始枚举值。

### 3.5 单 Shadow + 砍合成

- `scheduler.ts`：`selectShadows` 多选逻辑替换为 `shouldRunShadow` 单判定；调度只采用 `default` 定义，同一 root 同时最多一个审查运行。
- 删除 `src/runtime/synthesis.ts` 及 `runtime/index.ts` 中冲突检测、synthesis 状态与 status 面板字段；`replacesRunIds` 从 `report-batcher.ts`/`protocol.ts` 删除。
- `config.ts`/`types.ts` 删除：`heartbeatProbability`、`maxParallelShadows`、`synthesisModel`、`synthesisReasoningEffort`、`conflictSynthesisEnabled`、`conflictSynthesisTimeoutSeconds`、`preferIndependentVendor`、`defaultShadowModel`、`defaultReasoningEffort`（独立性计算保留用于报告展示）。
- 定义管理（`registry.ts`）：固定 id `default`。首次访问若 `default.md` 不存在则自动创建（内置通用审查 prompt）；若目录中已有旧定义，继承第一个旧定义的名称/职责提示词与执行配置，概率统一 0.7；旧文件只读保留、不再参与调度。通用 CRUD（create/update/setEnabled/delete）删除，新增 `saveDefault`。
- 模板面板改为「审查风格预设」下拉（contrarian/hacker/researcher/simplifier/architect/implementation-reviewer）：选择后预填职责提示词与轨迹截取。

### 3.6 删除谓词配置

- 删除 `src/runtime/prefilter.ts` 及其导出、测试；定义级 `preFilters`/`boostFilters`/`boostFactor` 与全局 `longOutputBoostChars`、`lastReportCoversCount`、`repeatedFailureBoostThreshold` 全部移除；旧定义文件含这些 front-matter 字段时容错忽略。
- `runtime/index.ts` 删除 `prefilterSkips`、`effectiveProbabilities` 及 `scheduleTurn` 中的谓词评估。
- `probes.ts` 保留（审查提示词内的探针清单属于提示词资产，不属于调度谓词）。

### 3.7 命令审查：整体删除（追加决定）

- 删除 `src/runtime/command-gate.ts`、全部 `commandGate*` 设置、法官编排、Tier 0/1 模式、统计与状态字段；`config.ts`/`types.ts`/`runtime/index.ts`/`tool/index.ts`/`client/*`/生成的 typert 工件与 patch 脚本同步收敛。
- 依据：真实环境实测法官链路可永久卡死（槽位占用 → 后续命令全部 `command gate judge wait aborted`），可靠性不足的功能不值得继续维护。

### 3.8 迁移兼容

- 设置：schemastery `z.object` 对未知键宽松透传、不报错——已删除字段的旧持久化值会原样保留在设置存储中，但新运行时不再读取任何相关字段（已用真实 `settings.yaml` 模拟解析验证：无加载异常、无裁决异常），因此无需迁移脚本；后续通过设置存储的自然重写可清理旧键。
- 定义文件：不删除磁盘文件；非 default 定义不再参与调度，页面只读提示。
- 默认概率：`default.md` 创建时统一 0.7（覆盖旧值，按 D3 决定）。

### 3.9 工具面与 `/shadow` 命令

- `tool/index.ts`：删除 `create_shadow`/`update_shadow`/`enable_shadow`/`disable_shadow`/`delete_shadow`；新增 `update_default_shadow`（合并补丁写入 default）；`list_shadows` 保留（默认定义 + 旧文件诊断）；`get_shadow_config`/`update_shadow_config` 参数与返回删除被砍字段；`/shadow` 输出精简为「开关状态、运行数、累计运行、最近结果」。

### 3.10 文档与测试

- docs：本文档；`target-architecture`、`review-quality-directions`、`installation-runtime-validation`、`subagent-binding-and-command-gate-design`、`technical-design` 中多 Shadow/谓词/合成/闸门描述标注「已移除」；`examples/shadow-minds/` 保留作为预设数据源并注明。
- tests：删除 scheduler 多选/prefilter/synthesis/command-gate 相关 spec；registry/模板/工具/typert/组装流程 spec 同步收敛；新增单 Shadow 语义测试（旧定义不参与调度）。

## 4. 实施阶段与结果

- **阶段 A（UI 层）**：toast、页面重构、滑杆、控件、错误文案映射 ✅
- **阶段 B（运行时收敛）**：单 Shadow 调度、砍合成、删谓词、schema 收敛、删除命令闸门 ✅
- **阶段 C（文档与测试）** ✅；`pnpm run check`（typert 校验 + typecheck + 137 测试 + 构建 + 冒烟）全绿。
- **阶段 D（live 部署与复验）**：lib/ 已部署进 live profile ✅；harness 已重启并用新构建运行；服务端验收通过（工具面四项、`default.md` 自动创建、默认超时 600s、旧定义只读提示）✅；**唯一未闭环 = 用户 Ctrl+F5 确认超时字段渲染占位符 600 与说明文字** ⏳。

## 5. 决策记录

- **D1 单 Shadow 落盘**：固定 id `default` 自动创建，旧定义只读保留 ✅
- **D2 状态面板**：彻底移除运行时指标，仅保留最近一次审查结果 ✅
- **D3 默认 70%**：迁移时统一覆盖为 70% ✅
- **D4 注册表 API**：彻底删除多定义 API ✅
- **D5 命令审查**：整体删除（追加决定）✅
