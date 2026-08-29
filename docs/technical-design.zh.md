# Shadow Mind 技术方案

本文记录参考 ZIP 中 `pi-shadow-mind` 的行为、独立 DSH 插件的对应设计、运行生命周期、数据披露规则和发行方式。实现以 DeepSeek Harness 的公开插件扩展点为基础，不修改 `agent-loop`。当前机制分别由[目标架构](target-architecture.zh.md)、[审查条件机制](review-conditioning.zh.md)与[审查质量方向](review-quality-directions.zh.md)维护。

## 1. Pi Shadow Mind 的功能与实现

参考 ZIP 包含 `pi-shadow-mind` `0.1.14`。它提供概率式后台审查：主 agent 完成一个使用过工具的轮次后，系统可以自动启动若干专门的 Shadow，在独立上下文中审查主任务；只有有用的报告才回传给主 agent，用户不需要逐次手动启动审查。

### 1.1 调度与定义

Pi 只评估带工具结果的主 agent `turn_end`。默认 heartbeat 概率为 `1/3`，每个 Shadow 的默认独立激活概率为 `0.3`，全局最多并行两个 Shadow。符合模型过滤条件的定义分别抽样；命中数超过并发槽位时，通过 Fisher–Yates 随机选择无偏子集。

Shadow 定义使用带 YAML frontmatter 的 Markdown 文件。字段包含 id、名称、启用状态、debug、激活概率、适用模型、运行模型、thinking level、超时和额外工具，Markdown 正文是该 Shadow 的职责提示词。Pi 还提供定义与全局配置管理工具、`/shadow` 命令、`Alt+S` 快捷键、状态面板和消息 renderer。

### 1.2 独立执行

每次激活都会创建全新 Session，不复用上一次 Shadow 的隐藏历史。Child 继承一份 system prompt，并接收删除 assistant thinking 后的序列化主轨迹。默认工具为 `read`、`grep`、`find` 和 `ls`，另有终态 `report_to_main` 工具。`debug: false` 使用内存 Session，`debug: true` 保存调试 Session。

无关审查返回精确的 `NOT_RELEVANT` sentinel；有发现时调用 `report_to_main`，调用后结束本次运行。已知文件工具结果会被压缩为计数和首行预览，未知工具不公开文本预览。新的用户输入、暂停或 shutdown 会取消活动运行并丢弃待处理报告；print/JSON headless shutdown 会等待运行、批处理、消息投递和主 agent 空闲。

### 1.3 关键作用

Pi 的作用不是增加主 agent 的隐藏推理，而是增加一个独立模型请求和可选择的第二视角。Shadow 报告回到主 agent 后会影响后续请求，因此系统需要同时处理触发概率、成本、取消、报告可信度、权限和持久化。

## 2. 独立 DSH 插件方案

仓库发布一个 npm 组合包 `@whutzefengxie-ops/dsh-shadow-mind`。包根入口提供运行时，`./tool` 提供八个管理工具和 `/shadow`，`./client` 提供 Web 模块，`./typert` 提供 Host Remote 描述，`cordis.patch.yml` 把运行时和工具两行加入目标 profile。

```text
dsh plugin add
  -> profile 记录 bundle
  -> cordis.patch.yml
     -> ShadowMindRuntime (ctx.shadowMind)
     -> 管理工具与 /shadow
  -> 根包 dsh.client 清单
     -> 设置页、Remote、会话报告卡片
```

DSH 的浏览器模块扫描 Loader 中已经挂载的包；根运行时行足以发现同一包的 `dsh.client` 和 `./client`，因此 patch 不添加仅用于 UI 的第三行。Host Typert Loader 同样从根包的 `./typert` 注册 `shadowMind` Remote 描述。

### 2.1 触发与调度

运行时监听持久化 `session/event`。一个 root `turn/end` 必须正常完成，且该 turn 至少包含一个 `tool/result`，才进入 heartbeat、定义激活、模型过滤、重复 id 和并发槽位判断。带 `parentSession` 的 child 或后代不会递归调度。

每个 root 拥有独立的 epoch、活动运行表、待调度集合、报告 batcher、累计运行数和最近结果。新的真实用户输入、用户取消、暂停、root dispose、插件 dispose 或 headless drain 超时会推进 epoch 并中止已准入工作；报告投递前再次核对 root 身份和 epoch，从而拒绝迟到结果。

### 2.2 Child 运行

被选中的定义通过 `ctx.subagents.start('shadow-mind', request)` 启动一次性 child，使用 `maxDepth: 1`、独立 Session、每次运行的 AbortSignal、工具 allowlist、结构化输出 schema、可选模型选择、context 继承策略与 think-first 标志。插件在同名 provider 不存在时注册自己的进程内实现，并复用 DSH 已发布的 child 创建与策略继承原语；预先注册的同名 provider 必须显式声明本次请求需要的条件能力，否则运行在 start 阶段失败。没有单独模型配置时继承 root 路由；如果只配置 reasoning effort，必须能从定义、全局设置或 root 得到完整 `provider/model`。

Child approval 固定为 `never`，并继承 parent 显式 sandbox 覆盖，不能通过批准对话扩大权限。默认工具为 `read`、`grep` 和 `glob`；定义添加的写入工具仍可能修改继承 sandbox 已允许的内容，因此不把“额外工具”默认为只读。

Child 必须返回对象根结构：`status` 为 `not_relevant`、`silent` 或 `report`，`content` 为字符串。`report` 还要求 `verdict` 为 `challenge`、`gap`、`confirm` 或 `uncertain`；可选 `severity` 必须位于零到一，可选 `refs` 必须是投影视窗中最多八个升序唯一 sequence。`report` 的 content 去除首尾空白后必须非空且不超过报告上限，其他状态要求空 content 且禁止 envelope 字段。超时、provider 失败、非完成结束、无效结构化输出或 dispose 失败只记录终态，不会把部分 assistant 文本转发给 root。

### 2.3 轨迹投影与报告持久化

投影以触发 `turn/end` 的序号为水位，只读取此前持久化事件。它包含带 sequence 的用户文本、可见 assistant 文本、工具名、可选工具参数、确定性结果摘要、compaction 摘要和较早 Shadow relay；它排除 reasoning、流式 chunk、原始工具结果正文和水位之后的事件。默认 `argumentDisclosure: redacted` 不复制工具参数；定义使用 `capture: since-compaction` 时，从最近成功 compaction epoch 截获并保留 summary。

被接受的报告按 severity 降序进入固定窗口批次，并作为来源 `{ kind: 'shadow-report', form: 'relay' }` 的持久化 `user/message` 写入 root。来源记录每个 Shadow id、run id、child Session id、捕获水位、verdict、refs、可选 severity 与可选综合替换 id。运行中的 root 使用 `steer()`，空闲 root 使用 `followup()`；模型可见报告能够从 Session 日志重建。

运行状态不写成仓库外自定义 Session 事件。当前 DSH 不提供为这类事件设置 `ignorable: true` 的公开写入接口，持久化未知事件会使未加载本插件的 Harness 拒绝恢复会话。插件改为通过只读 Remote 暴露按捕获水位分组的审查周期快照；报告仍由已知的 `user/message` 事件持久化，运行中、`silent`、`not_relevant`、取消和失败状态只用于 Web 展示和诊断，不进入主 agent 的模型历史。

### 2.4 运行状态与调试日志

每次准入运行按以下状态推进：

```text
scheduling -> running -> report | silent | not_relevant | aborted | failed
```

审查周期以触发它的 root `turn/end` 序号为 `capturedThroughSeq`。周期快照包含调度是否完成、每个 run 的 id、Shadow id 与名称、child Session id、阶段、终态、provider stop reason、稳定原因码和安全错误摘要。客户端在新周期出现时立即读取快照；仅当周期仍在调度或存在运行项时继续短轮询，终态后停止轮询。

取消必须先在插件内记录结构化来源，再触发 AbortSignal。原因码至少区分新用户消息、用户终止 turn、暂停、root 释放、插件释放、Shadow 超时、headless drain 超时、headless maintenance 取消和无法归因的 provider abort。失败原因码至少区分轨迹或模型选择准备、subagent 启动、结果等待、dispose、结构化输出验证、报告验证和报告回传。阶段固定为 `prepare`、`start`、`run`、`dispose`、`validate` 或 `relay`。

启用定义的 `debug` 后，每个 run 的 JSONL 至少记录 `run-admitted`、`child-started` 和 `run-finished`；收到取消时另记 `run-cancellation-requested`，报告回传另记成功或失败。记录包含 schema 版本、时间、root/run/child 标识、捕获水位、阶段、稳定原因码、取消发起者和 provider stop reason。日志不记录 prompt、轨迹、工具参数、报告正文、凭据或 stack；错误只保留长度受限且已过滤令牌和绝对路径的名称、错误码与消息摘要。日志写入失败不改变 Shadow 结果。

### 2.5 Web 设置与会话展示

“设置 → 插件 → Shadow Mind”通过 settings namespace 和生成的 Remote 管理当前 root 状态与单一 `default` 定义。定义可配置启用、激活概率、child 模型（供应商/模型/思考强度）、reasoning effort、超时、截获视窗、context、think-first、holdout、工具与提示词；全局设置保留 review window、value loop、软硬预算与陈旧衰减等内部默认项。多定义 CRUD、skip/boost 谓词、vendor 偏好与冲突综合已随产品收敛移除（见 [`settings-ux-revamp.zh.md`](settings-ux-revamp.zh.md)），命令闸门能力亦已整体删除。

插件通过 `conversation.chat.node` 为每个正常完成的 root `turn/end` 建立候选审查节点，并以该事件序号作为固定显示锚点。没有进入 Shadow 调度的节点不渲染；一旦周期准入，节点立即显示运行占位卡片，并明确提示“此时发送新消息会取消本轮审查”。同一节点随后原位更新为报告、`silent`、`not_relevant`、取消或失败终态，因此多轮审查各自停留在实际发生的位置。

持久化 Shadow relay 通过其 provenance 中的 `capturedThroughSeq` 更新对应审查节点，并隐藏 relay 自身的通用 Context 行。报告正文使用 DSH 的 `MarkdownText` 渲染 GFM、表格、代码块和 TeX；原始 HTML、相对链接和不安全协议继续由官方组件过滤。运行快照可先显示刚完成但尚在批处理窗口内的报告，relay 到达后以持久化内容为准。

`report` 是唯一可以进入 batcher 并 relay 给主 agent 的终态。`silent`、`not_relevant`、`aborted` 和 `failed` 只更新卡片、状态和调试日志，不调用 `steer()` 或 `followup()`；Shadow relay 的来源类型也不匹配“真实用户输入”取消监听。两项约束共同保证状态卡片不会再次触发主 agent 或 Shadow 调度。

`/shadow retry|new` 只作用于当前 root：`retry` 重试本会话最近一次失败或中断的运行，`new` 在会话尚未准入任何运行前强制立即审查。运行与最近终态继续由设置页和对话卡片展示；活动数恢复为零后，最近结果仍可证明本进程内发生过运行。

## 3. 与 Pi 的有意差异

DSH 复用现有 `read`、`grep` 和 `glob`，不实现 Pi 的 `find`、`ls` 或专有 Session 驱动。插件专用 provider 的 `structured_output` 终态替代 `NOT_RELEVANT` 和 `report_to_main`，使 schema 校验、提交与同 child think-first continuation 在一个运行生命周期内完成。模型过滤支持对 model id 或完整路由使用本地 `*`/`?` glob，比 Pi 的精确完整路由匹配更宽。

DSH 默认不公开工具参数和结果预览；Pi 会保留工具参数并为已知文件工具提供首行预览。DSH child 遵循现有 Session 持久化策略，而不是在 `debug: false` 时切到内存。插件保留通用 approval 和命令显示，不实现 `Alt+S`。

## 4. 独立发行与安全

源码仓库独立于 `deepseek-harness`。DSH 能力包是可选 peer；运行时从 profile 的安装级模块回退解析与当前 DSH 安装一致的 Service Definition，避免安装第二套 Cordis 或 Harness 单例。

仓库提交预构建 `lib/` 且没有 `prepare`。因此 GitHub 源码安装不会执行本包构建脚本，也不需要 pnpm `allowBuilds`。安装命令应固定审核过的 commit SHA；更新时同时审查源码和构建产物。

仓库忽略 `.env`、私钥、本地 Harness home、Session、JSONL、压缩会话、验收输出和日志。提交前仍必须搜索 API Key、authorization header、私钥标记、真实 Session id 和机器绝对路径，并审查完整 staged diff。插件不保存 provider 凭据；定义与 debug 记录保存在用户的 `DSH_HOME`，不属于仓库内容。

## 5. 验收标准

安装层验收要求 `dsh --profile web --dump-config` 同时出现 `shadow-mind-runtime` 和 `tool-shadow-mind`，客户端启动清单出现根包，Web 启动无 Typert、Remote 或客户端注入错误。

功能验收使用新 Session，把 heartbeat 与定义激活概率都设为 `1`，启用匹配全部模型的审查定义，再让 root 明确使用至少一个工具。运行开始后，被审查回复下方应立即出现占位卡片和新消息取消提示，并在完成后保持锚点不变；未触发调度的会话可用 `/shadow new` 强制准入，失败运行可用 `/shadow retry` 重试。

`report` 验收要求 Session 日志包含带 verdict 与 refs 的持久化 relay，root 自动完成 follow-up，卡片正文正确渲染标题、列表、表格和代码块，并可跳转 child Session。`silent` 必须显示明确终态卡片且 Session 中没有 Shadow relay；`not_relevant`、取消和失败同样不得生成伪报告。新用户消息取消用例必须显示 `USER_MESSAGE_RECEIVED`，包括已验证但仍待 relay 的报告；Shadow 超时必须显示 `SHADOW_TIMEOUT`，调试 JSONL 能从 `run-admitted` 还原到 `run-finished` 且不包含提示词、报告、绝对路径、stack 或凭据。
