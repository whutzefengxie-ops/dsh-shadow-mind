# 设计文档：Shadow 子代理与 DSH 配置绑定 + pwsh 命令闸门

> 范围：同一 PR 下实现两个能力。
> 能力一：所有 Shadow 子代理（评审影子、冲突综合、闸门法官）与 DSH 已配置的 Agent 预设 / 供应商 / 模型 / 思考强度绑定，设置页用下拉框选择。
> 能力二：在主 Agent 的 `pwsh`（执行命令）执行前阻断，根据上下文、环境与提示词决定是否放行；首要场景：改项目时防止主 Agent kill 掉生产环境服务。

---

## 1. 现状盘点（代码事实）

### 1.1 Shadow 子代理链路

- `src/runtime/subagent-provider.ts` 注册 `shadow-mind` 子代理提供者（`SHADOW_MIND_SUBAGENT_PROVIDER`），模块增强声明了 `SubagentStartRequest.modelSelection`（`ModelSelection = { provider, model, reasoningEffort? }`）。
- `startInProcessRun()` 通过 `installModelSelection(childCtx, …)` 把模型选择安装进子代理作用域，并在 `resolveChildAgentOptions` 时注入 `provider/model`。
- 运行时已支持按“路由字符串”选模型：`src/runtime/model-route.ts`（`provider/model` 单一字符串），解析在 `src/runtime/index.ts` 的 `modelSelection()`（优先级：覆盖 > 定义 `runWithModel` > 设置 `defaultShadowModel` > 继承根路由）。
- 设置页 `src/client/ShadowMindSettingsTab.tsx` 目前对 `runWithModel` / `reasoningEffort` / `defaultShadowModel` / `frugalShadowModel` 使用**纯文本输入框**，无目录校验，无下拉框。

### 1.2 DSH 侧模型目录（下拉框数据源）

- `ctx.llm.listProviders()` → 供应商路由列表（`ProviderInfo { id, name, … }`）。
- `ctx.llm.listModels(providerId)` → 模型列表（`LlmModelInfo { id, name, description? }`）。
- `ctx.llm.resolveModelInfo(providerId, modelId)` → `reasoning: { efforts: [{ id, name, description? }], defaultEffort? }`（适配器自有思考强度，逐模型不同）。
- DSH 主程序已有权威目录构造先例：`packages/host/apiproxy/src/api-proxy.ts` 的 `buildModelCatalog()`（groups + failures 双轨，单个供应商失败不影响其它分组）。
- Shadow 插件 host 端已把 `@deepseek-ai/dsh-llm` 声明为 peerDependency，可直接调用 `ctx.llm`。

### 1.3 DSH 侧 Agent 预设（"配置好的 agent"）

- `ctx.agentPresets.list()` → `AgentPreset[]`（id、名称、插件组合行）。预设是插件组合（`cordis.yml` 风格的 rows），persona 通过 `persona` 插件行（`packages/preset/persona`，`name = 'persona'`，`config: { text }`）声明。
- 预设不携带 provider/model（模型由会话的模型菜单独立选择），因此"绑定 agent"的 v1 语义 = **绑定预设的 persona 与工具基调**，模型维度由三个下拉框独立绑定。

### 1.4 工具执行拦截点（能力二的地基）

- DSH 工具管线（`packages/core/tools/src/index.ts`）在调度前运行 `tools/pre-execute` 瀑布（scope-filtered，异步，返回 `PreToolDecision = {kind:'allow'} | {kind:'deny',reason} | {kind:'ask'}`），随后才是单调同步 `guard`（只能拒绝）、`tools/execute`（around）、`tools/post-execute`。
- 已有官方先例：`packages/hooks/hooks-codex/src/index.ts:225` 与 `hooks-claude-code` 用 `ctx.on('tools/pre-execute', …)` 实现 PreToolUse 权限闸门 —— 与我们要做的是同一种拦截。
- 插件 realm 注册的监听器是全局作用域，能收到所有 Agent 的调用；`exec.agent` 可用于限定"仅根 Agent"。`deny` 会让工具在 body 执行前失败，返回 `Error: <reason>` 文本给模型 —— 主 Agent 的 turn 会在闸门裁决期间保持阻塞（这正是"阻断"语义）。
- 注意：`tools/pre-execute` 返回 `{kind:'ask'}` 会走审批服务；本会话审批策略为 `never` 时 ask 会被确定性拒绝。闸门自身的 LLM 裁决**不经过审批服务**（直接 allow/deny），避免被 `never` 策略误伤。

---

## 2. 能力一：子代理与 DSH 配置的 Agent/模型绑定 + 下拉框

### 2.1 数据面：新增远端 RPC `modelCatalog`

- 在 `ShadowMindRuntime` 上新增 `@Remote('modelCatalog')`（typert 生成客户端，模式与现有 `catalog/create/status` 一致）。
- 返回值：`{ groups: ModelProviderGroup[], failures: ModelCatalogFailure[], agentPresets: ShadowAgentPreset[] }`
  - `groups/failures`：照搬 apiproxy `buildModelCatalog` 的语义，从 `ctx.llm.listProviders()/listModels()/resolveModelInfo()` 构建（隐藏 provider 内部失败、丢弃空分组）。
  - `agentPresets`：`{ id, name }`（来自 `ctx.agentPresets.list()`）。
- 客户端：扩展 `ShadowMindSettingsTabInjected.catalog()` 返回的 `ShadowAdministrationSnapshot`（增加 `modelCatalog` 字段），设置页加载一次即得全部下拉数据。

### 2.2 绑定语义

每个子代理消费方有独立的 `ModelSelection`（provider + model + reasoningEffort）与可选 `agentPresetId`：

| 消费方 | 模型绑定字段（新增/复用） | Agent 预设绑定 |
| --- | --- | --- |
| 评审影子（每个定义） | 复用 `runWithModel` + `reasoningEffort` | 新增 `agentPreset` |
| 冲突综合 | 新增 `synthesisModel` / `synthesisReasoningEffort` | 新增 `synthesisAgentPreset` |
| 闸门法官（能力二） | 新增 `commandGateModel` / `commandGateReasoningEffort` | 新增 `commandGateAgentPreset` |
| 全局默认 | 复用 `defaultShadowModel` / `defaultReasoningEffort` | 新增 `defaultAgentPreset` |

- 预设绑定 v1 语义：运行时解析预设组合中的 `persona` 行文本 → 作为子代理的 `request.persona`（`applyChildComposition` 已支持）；预设解析失败时回退到继承根 persona，并在 debug 日志记录。工具集派生（读取预设组合中的工具行）列为 v2。
- 存储格式：**保持现有 `provider/model` 路由字符串不变**（`SHADOW_MODEL_ROUTE_PATTERN` 校验不变），下拉框在 UI 层组合/拆解字符串；`reasoning_effort` 依旧是独立字符串字段。这样对模型侧管理工具（`create_shadow`/`update_shadow_config`）零破坏。
- 缺目录行兜底：目录中不存在但已保存的路由（如供应商临时失败）仍显示原始值，等同于 DSH 模型菜单的 "Select model" 兜底语义。

### 2.3 下拉框 UI（`ShadowMindSettingsTab.tsx`）

新增 `ModelRouteSelect` 组件（`src/client/ModelRouteSelect.tsx`）：

1. **供应商** `<select>`：选项来自 `groups[].id/name` + 失败分组（禁用态，内联错误）。
2. **模型** `<select>`：选中供应商后联动过滤 `group.models`。
3. **思考强度** `<select>`：选项来自所选模型的 `model.reasoning.efforts`（id/name/description 提示）+ 首项「继承默认」；当适配器不公布 efforts 时回退到 `reasoningEffortLadder` 提供候选。
4. **Agent 预设** `<select>`（可空，首项「不绑定」）：选项来自 `agentPresets`。
5. 提交时组合成 `provider/model` 字符串 + effort 字符串；编辑时反向拆解。目录加载失败显示内联错误并保留旧值。

替换位置：设置页 `defaultShadowModel`/`frugalShadowModel`/`defaultReasoningEffort` 三处文本输入，定义编辑器的 `runWithModel`/`reasoningEffort`（当前 `Field` 文本输入，`ShadowMindSettingsTab.tsx:760-770`）。

### 2.4 覆盖"所有 subagent"

- 评审影子、综合、闸门法官三个 spawn 点统一走 `resolveRunModel(definitionOrSettings, root, overrides)`（把现有 `modelSelection()` 泛化），保证"每个子代理都可选供应商/模型/思考强度"。
- 运行时校验：`assertConditioningCapabilities` 保持；route 可路由性由 spawn 时的 `agentOptions` 注入自然校验（不可路由时子代理启动失败并进入现有错误路径）。

---

## 3. 能力二：pwsh 命令闸门（Command Gate）

### 3.1 拦截点

`ShadowMindRuntime` 构造时注册：

```ts
ctx.on('tools/pre-execute', async (exec, next) => {
  if (!gate.shouldJudge(exec)) return next()
  const verdict = await gate.decide(exec)   // 主 Agent 的 turn 在此阻塞
  return verdict.allow ? next() : { kind: 'deny', reason: verdict.reason }
})
```

- `shouldJudge`：`commandGateEnabled && commandGateTools.includes(exec.name)`（默认 `['pwsh']`）且 `commandGateScope` 匹配（默认 `root-only`，即仅 `isRoot(exec.agent)`；影子子代理、法官自身永不递归闸门）。
- 先例：`hooks-codex` PreToolUse；`deny` 返回 `Error: <reason>` 文本给主 Agent，模型可据此改换命令或解释。

### 3.2 分层裁决管线（低延迟优先）

| 层 | 判定 | 说明 |
| --- | --- | --- |
| Tier 0 硬拒 | 确定性，0 延迟 | 命令命中 `commandGateDenyPatterns`（默认覆盖 `Stop-Process`/`Stop-Service`/`Restart-Service`/`taskkill`/`kill`/`shutdown`/`Stop-Computer`/`Restart-Computer`/`Remove-Item -Recurse`/`Format-*`/`Clear-Disk` 等），或同时命中破坏性动词与 `commandGateProtectedProcesses`/`commandGateProtectedServices`（用户声明要保护的生产进程/服务名）→ 直接拒绝，附命中原因。 |
| Tier 1 硬放 | 确定性，0 延迟 | 命令命中 `commandGateAllowPatterns`（纯只读：`Get-*`/`pwd`/`ls`/`git status|diff|log`/`Write-Output` 等）且未命中任何拒绝模式 → 直接放行。 |
| Tier 2 法官 | LLM 裁决，阻塞主 Agent | 其余命令唤起**闸门法官**（Shadow 子代理，复用 `shadow-mind` provider + `structured_output`），返回 `{ decision: 'allow'|'deny', reason }`。 |

### 3.3 闸门法官（subagent）

- 模型绑定：`commandGateModel`/`commandGateReasoningEffort`/`commandGateAgentPreset`（未配置时继承根路由）——即能力一的下拉框直接复用。
- 输入上下文（有界，`maxPromptChars` 约束）：
  1. 待审命令：`exec.arguments.command` + `description` + `workdir`（pwsh 工具的参数面）。
  2. 环境声明：`commandGateContext` 自由文本（用户写"本机运行生产服务 X/Y，禁止 kill"）+ `commandGateProtectedProcesses/Services` 列表 + 工作区根路径等静态环境事实。
  3. 轨迹：复用 `projectTrajectory`/`summarizeToolResult`（`src/runtime/trajectory.ts`）投影最近 N 轮根 Agent 轨迹（受 `maxPromptChars` 截断）。
  4. 固定提示词模板：明确"保护环境不可破坏；不确定时 deny"；要求结构化输出。
- 裁决超时 `commandGateJudgeTimeoutSeconds`（默认 30s）：超时/法官失败按 `commandGateOnJudgeFailure` 处理（默认 `deny`，fail-closed，理由写明"闸门裁决失败"）。
- 并发与去重：`commandGateMaxParallel`（默认 1，队列化）；相同 `(agent, command)` 在 `commandGateVerdictTtlSeconds`（默认 120s）内直接复用上次裁决（防模型重试同一命令反复支付 LLM 成本）；新用户消息/闸门配置变更使缓存失效。
- 阻断语义：法官在 `tools/pre-execute` 内完成裁决，主 Agent 的 turn 期间阻塞等待；`exec.signal` 中止时立即释放（返回取消/拒绝，不悬挂）。

### 3.4 生产 kill 场景演练

主 Agent 执行 `pwsh { command: 'Stop-Process -Name prod-api' }`：
1. Tier 0：命中 `Stop-Process` 且 `prod-api` 在 `commandGateProtectedProcesses`（或用户环境声明中）→ 0 延迟硬拒：`Error: Shadow Mind 命令闸门拒绝: 目标 prod-api 是受保护的生产进程`。
2. 若未声明保护名单：Tier 2 法官读到轨迹（"正在改项目/部署"）、环境声明、命令目标 → 大概率 deny，附理由；主 Agent 收到错误后改问用户或改用只读命令。
3. 全程无需审批服务（`never` 策略不干扰）；拒绝事件进入闸门审计日志与 `/shadow status` 计数器。

### 3.5 审计与开关

- 每根 Agent 维护闸门日志（JSONL，风格同现有 registry debug log）：时间、命令、层、裁决、法官用时/失败原因。
- `ShadowMindStatus` 新增计数器：`gateDenies / gateAllows / gateJudgeRuns / gateJudgeFailures`，并入 `/shadow` 命令输出。
- `update_shadow_config` 工具参数面镜像新增字段（与 settings schema 一致），供主 Agent 自己配置保护名单（仍需审批/策略门，复用现有 approve 逻辑）。
- 兜底关闭：`commandGateEnabled: false`（默认关闭，避免影响存量用户）；本仓库测试环境默认开启。

---

## 4. 配置 schema 变更（`src/runtime/config.ts` + `types.ts`）

能力一：

```ts
// 定义级（ShadowDefinition）
agentPreset?: string          // DSH agent 预设 id，null 清除
// 设置级（ShadowMindSettings）
defaultAgentPreset?: string
synthesisModel?: string        // pattern: SHADOW_MODEL_ROUTE_PATTERN
synthesisReasoningEffort?: string
synthesisAgentPreset?: string
```

能力二（全部带默认值，默认关闭）：

```ts
commandGateEnabled: boolean            // false
commandGateTools: string[]             // ['pwsh']
commandGateScope: 'root-only' | 'root-and-subagents'  // 'root-only'
commandGateDenyPatterns: string[]      // kill/破坏性命令默认集
commandGateAllowPatterns: string[]     // 只读命令默认集
commandGateProtectedProcesses: string[]// []
commandGateProtectedServices: string[] // []
commandGateContext: string             // 环境声明自由文本
commandGateModel?: string              // route 字符串
commandGateReasoningEffort?: string
commandGateAgentPreset?: string
commandGateJudgeTimeoutSeconds: number // 30
commandGateOnJudgeFailure: 'deny' | 'allow' // 'deny'
commandGateMaxParallel: number         // 1
commandGateVerdictTtlSeconds: number   // 120
```

---

## 5. 实施清单（同一 PR）

新增：

- `src/runtime/command-gate.ts`：闸门服务（pre-execute 监听、分层判定、法官编排、超时、去重缓存、统计、审计日志）。
- `src/runtime/model-catalog.ts`：`buildShadowModelCatalog(ctx)`（llm 目录 + agent 预设）。
- `src/client/ModelRouteSelect.tsx`：三级联动下拉 + 预设下拉。
- `scripts/patch-typert.mjs`：已提交的 typert 生成文件（本仓库已与 DSH 生成器分歧）的维护补丁脚本。
- `tests/command-gate.spec.ts`：Tier 0/1 确定性、法官裁决、超时 fail-closed/fail-open、TTL 缓存、并发去重、作用域、日志与统计。
- `tests/command-gate-runtime.spec.ts`：运行时内真实法官链路（provider 请求断言、persona、modelSelection、审计日志、状态计数）。
- `tests/command-gate-e2e.spec.ts`：隔离临时目录 + 真实 PowerShell + 真实 fixture 进程 + 真实 AgentLoop 的端到端（对照臂真的 kill，闸门臂保活）。
- `tests/model-catalog.spec.ts`：目录构建、失败隔离、空分组丢弃、服务缺失兜底。

修改：

- `src/runtime/index.ts`：构造闸门并接线/释放；`@Remote('modelCatalog')`；`remoteExportCatalog` 携带 `modelCatalog`；`judgeVerdict`/`resolveAgentPresetPersona`/`gateModelSelection`/`buildGateJudgePrompt`；synthesis 绑定；状态计数器。
- `src/runtime/config.ts` / `types.ts` / `registry.ts`：schema、类型、frontmatter（`agent_preset`）。
- `src/runtime/subagent-provider.ts`：复用既有 `persona`/`modelSelection` 能力，无需改动。
- `src/tool/index.ts`：`create_shadow`/`update_shadow` 增加 `agent_preset`；`update_shadow_config` 增加全部闸门参数。
- `src/client/ShadowMindSettingsTab.tsx` / `ModelRouteSelect.tsx` / `locales.ts` / `client/index.ts`：命令闸门区块、下拉替换、字典、可空字段清空列表。
- `src/generated/typert.{host.js,remote-client.js,remote-client.d.ts}`：手工同步 schema（agentPreset、modelCatalog、闸门计数）与 `modelCatalog` descriptor。
- `tests/forms.spec.ts` / `tests/typert.spec.ts` / `tests/tool-shadow-mind.spec.ts` / `tests/runtime-lifecycle.spec.ts`：fixture 与 persona 注入覆盖。
- `README.md` / `README.zh.md`：两个新能力的用户文档。

---

## 6. 端到端验证方案（隔离测试环境）

- 使用独立临时目录（`%TEMP%\dsh-shadow-e2e-*`）作为工作区与 DSH home，**不触碰任何生产路径/进程**；命令闸门测试目标只针对测试目录内自建的模拟服务（如临时起的 node 进程），并在断言后自行清理。
- e2e 组合：DSH Loader（`examples/` 中既有 fixture 模式）挂载 `tool-pwsh`（或 fake pwsh 工具）+ 本插件；mock LLM（复用 `tests/mock-adapter.ts`）驱动主 Agent 发出 kill 命令，断言闸门拒绝且生产（测试）进程存活。
- 客户端下拉框用 vitest + jsdom 组件测试验证联动与保存。

## 7. 风险与边界

- **默认关闭**：闸门默认 `enabled: false`，本 PR 不改变存量行为。
- **Fail-closed 与误伤**：Tier 0 默认模式集可能误拒开发中合法的进程管理命令；缓解：命中即附带明确 reason，用户可用 `commandGateAllowPatterns` 白名单或关闭闸门。
- **审批策略交互**：闸门裁决不走 `approval/request`，`never` 策略不使闸门失效；后续可加"deny 后允许用户一键放行"走审批服务（v2）。
- **延迟成本**：Tier 2 每次裁决是一次 LLM 调用；去重缓存 + 只读命令硬放行控制成本。
