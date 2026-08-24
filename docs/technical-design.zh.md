# Shadow Mind 技术方案

本文记录参考 ZIP 中 `pi-shadow-mind` 的行为、独立 DSH 插件的对应设计、运行生命周期、数据披露规则和发行方式。实现以 DeepSeek Harness 的公开插件扩展点为基础，不修改 `agent-loop`。

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

被选中的定义通过 `ctx.subagents.start('spawn', request)` 启动一次性 child，使用 `maxDepth: 1`、独立 Session、每次运行的 AbortSignal、工具 allowlist、结构化输出 schema 和可选模型选择。没有单独模型配置时继承 root 路由；如果只配置 reasoning effort，必须能从定义、全局设置或 root 得到完整 `provider/model`。

Child approval 固定为 `never`，并继承 parent 显式 sandbox 覆盖，不能通过批准对话扩大权限。默认工具为 `read`、`grep` 和 `glob`；定义添加的写入工具仍可能修改继承 sandbox 已允许的内容，因此不把“额外工具”默认为只读。

Child 必须返回对象根结构：`status` 为 `not_relevant`、`silent` 或 `report`，`content` 为字符串。`report` 要求去除首尾空白后非空且不超过报告上限，其他状态要求空内容。超时、provider 失败、非完成结束、无效结构化输出或 dispose 失败只记录终态，不会把部分 assistant 文本转发给 root。

### 2.3 轨迹投影与报告持久化

投影以触发 `turn/end` 的序号为水位，只读取此前持久化事件。它包含用户文本、可见 assistant 文本、工具名、可选工具参数、确定性结果摘要、compaction 摘要和较早 Shadow relay；它排除 reasoning、流式 chunk、原始工具结果正文和水位之后的事件。默认 `argumentDisclosure: redacted` 不复制工具参数。

被接受的报告进入固定窗口的有序批次，并作为来源 `{ kind: 'shadow-report', form: 'relay' }` 的持久化 `user/message` 写入 root。来源记录每个 Shadow id、run id、child Session id 和捕获水位。运行中的 root 使用 `steer()`，空闲 root 使用 `followup()`；模型可见报告能够从 Session 日志重建。

### 2.4 Web 设置与会话展示

“设置 → 插件 → Shadow Mind”通过 settings namespace 和生成的 Remote 管理全局设置、Markdown 定义和当前 root 状态。每项定义可配置启用、激活概率、模型过滤、child 模型、reasoning effort、超时、工具与提示词。

当前 upstream master 没有独立插件可用的 `conversation.chat.contextview` 扩展点，因此报告正文仍由通用 Context 行持久化显示；插件同时使用官方 `conversation.chat.turnTail`，在消费报告的 root follow-up 下显示完整 Shadow 卡片、child Session 跳转、捕获序号和“由 Shadow Mind 报告触发”标记。这让用户能够区分“Shadow 运行过”和“报告实际影响了哪次主回复”。

`/shadow status|pause|resume|toggle` 只控制当前 root。状态包含活动数、待调度数、累计准入运行数和最近终态；活动数恢复为零后，最近结果仍可证明本进程内发生过运行。

## 3. 与 Pi 的有意差异

DSH 复用现有 `read`、`grep` 和 `glob`，不实现 Pi 的 `find`、`ls` 或专有 Session 驱动。结构化终态替代 `NOT_RELEVANT` 和 `report_to_main`，使终态验证由 subagent provider 完成。模型过滤支持对 model id 或完整路由使用本地 `*`/`?` glob，比 Pi 的精确完整路由匹配更宽。

DSH 默认不公开工具参数和结果预览；Pi 会保留工具参数并为已知文件工具提供首行预览。DSH child 遵循现有 Session 持久化策略，而不是在 `debug: false` 时切到内存。插件保留通用 approval 和命令显示，不实现 `Alt+S`。

## 4. 独立发行与安全

源码仓库独立于 `deepseek-harness`。DSH 能力包是可选 peer；运行时从 profile 的安装级模块回退解析与当前 DSH 安装一致的 Service Definition，避免安装第二套 Cordis 或 Harness 单例。

仓库提交预构建 `lib/` 且没有 `prepare`。因此 GitHub 源码安装不会执行本包构建脚本，也不需要 pnpm `allowBuilds`。安装命令应固定审核过的 commit SHA；更新时同时审查源码和构建产物。

仓库忽略 `.env`、私钥、本地 Harness home、Session、JSONL、压缩会话、验收输出和日志。提交前仍必须搜索 API Key、authorization header、私钥标记、真实 Session id 和机器绝对路径，并审查完整 staged diff。插件不保存 provider 凭据；定义与 debug 记录保存在用户的 `DSH_HOME`，不属于仓库内容。

## 5. 验收标准

安装层验收要求 `dsh --profile web --dump-config` 同时出现 `shadow-mind-runtime` 和 `tool-shadow-mind`，客户端启动清单出现根包，Web 启动无 Typert、Remote 或客户端注入错误。

功能验收使用新 Session，把 heartbeat 与定义激活概率都设为 `1`，启用匹配全部模型的审查定义，再让 root 明确使用至少一个工具。`/shadow status` 应先后显示准入运行和最近终态；当终态为 `report` 时，Session 日志必须包含带来源信息的持久化 relay，root 自动完成 follow-up，回复下方显示报告卡片并可跳转 child Session。`not_relevant`、`silent`、取消和失败路径不得生成伪报告。
