#!/usr/bin/env node
/**
 * Shadow Mind 问题快速定位工具（零依赖，仅使用 Node 内置模块）。
 *
 * 从“子代理会话 id / 报错信息 / runId / 根会话 id”任一碎片出发，定位到：
 *   1. shadow 运行时间线   $DSH_HOME/shadow-minds/logs/<shadowId>.jsonl
 *   2. 本次运行的入参       $DSH_HOME/shadow-minds/<shadowId>.md（定义）+ 运行元数据
 *   3. 子代理完整会话       $DSH_HOME/sessions/<project>/<childSessionId>/session.jsonl.zstd
 *      —— 包含 prompt、LLM 调用、工具调用/失败、turn 终止原因（即“调用 LLM/接口出了什么问题”）
 *
 * 用法：
 *   node tools/shadow-debug.mjs trace <childSessionId|runId|rootSessionId>
 *   node tools/shadow-debug.mjs find  <报错文本|reasonCode|任意日志字段子串>
 *   node tools/shadow-debug.mjs runs  [--shadow <id>] [--limit N] [--failed]
 *   node tools/shadow-debug.mjs health
 *
 * 通用选项：
 *   --home <dir>      DSH 主目录（默认 $DSH_HOME，其次 ~/.dsh）
 *   --sessions <dir>  会话持久化根目录（默认 $DSH_HOME/sessions；
 *                     在 DSH 会话内运行时也可由 $DSH_SESSION_JSONL 推断）
 *   --shadow <id>     限定某个 shadow 定义
 *   --limit <n>       输出条数上限
 *   --events <n>      trace 时打印子代理会话最后 N 条事件（默认 15）
 *   --prompt          trace 时完整打印子代理 prompt（默认只打印头部与长度）
 *   --json            机器可读输出
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { zstdDecompressSync } from 'node:zlib'

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`shadow-debug: ${message}`)
  process.exit(2)
}

function warn(message) {
  console.error(`shadow-debug: 警告: ${message}`)
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2))
}

function truncate(text, max) {
  const s = String(text)
  return s.length <= max ? s : `${s.slice(0, max)}…(截断，共 ${s.length} 字符)`
}

/** 深值转展示字符串（对象压缩为单行 JSON）。 */
function display(value) {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

function isoToLocal(iso) {
  if (typeof iso !== 'string') return iso
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.toLocaleString('sv-SE')}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

// ---------------------------------------------------------------------------
// 命令行解析
// ---------------------------------------------------------------------------

const COMMANDS = new Set(['trace', 'find', 'runs', 'health', 'help'])

function parseArgs(argv) {
  const opts = {
    command: 'help',
    positional: [],
    home: undefined,
    sessions: undefined,
    shadow: undefined,
    limit: 20,
    events: 15,
    prompt: false,
    json: false,
    failed: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--home' || arg === '--sessions' || arg === '--shadow'
      || arg === '--limit' || arg === '--events') {
      const value = argv[++i]
      if (value === undefined) fail(`${arg} 需要参数`)
      const key = arg.slice(2)
      opts[key] = key === 'limit' || key === 'events' ? Number(value) : value
    } else if (arg === '--prompt') {
      opts.prompt = true
    } else if (arg === '--json') {
      opts.json = true
    } else if (arg === '--failed') {
      opts.failed = true
    } else if (arg.startsWith('-') && arg !== '-') {
      fail(`未知选项 ${arg}`)
    } else if (COMMANDS.has(arg) && opts.command === 'help' && opts.positional.length === 0) {
      opts.command = arg
    } else {
      opts.positional.push(arg)
    }
  }
  if (!Number.isInteger(opts.limit) || opts.limit <= 0) fail('--limit 必须是正整数')
  if (!Number.isInteger(opts.events) || opts.events < 0) fail('--events 必须是非负整数')
  return opts
}

const HELP = `
shadow-debug —— Shadow Mind 运行日志定位与失败分析工具

用法:
  node tools/shadow-debug.mjs <command> [options]

命令:
  trace <id>   追查一次 shadow 运行。id 可为:
               - childSessionId（子代理会话 id，形如 e7d0b857-122d-...）
               - runId（shadow 运行 id，形如 b7a03b95-eb7a-...）
               - rootSessionId（根会话 id，形如 session-148c0ec5-...，
                 命中多次运行时会先列出候选）
  find <text>  在所有 shadow 调试日志里检索文本（报错片段、reasonCode、
               providerStopReason、shadow id、会话 id 等），列出命中运行
  runs         列出最近的 shadow 运行（--shadow 过滤，--failed 只看失败/中止，
               --limit N 控制条数，默认 20）
  health       体检：各定义是否开启 debug、日志文件大小/最新记录时间、
               会话根目录是否可读

选项:
  --home <dir>      DSH 主目录（默认 $DSH_HOME，其次 ~/.dsh）
  --sessions <dir>  会话持久化根目录（默认 $DSH_HOME/sessions；
                    在 DSH 会话内运行时自动从 $DSH_SESSION_JSONL 推断）
  --shadow <id>     限定某个 shadow 定义
  --limit <n>       输出条数上限（runs/find 默认 20）
  --events <n>      trace 打印子代理会话最后 N 条事件（默认 15，0 关闭）
  --prompt          trace 完整打印子代理 prompt（默认只打印头部 600 字符）
  --json            机器可读输出
  --failed          runs: 只列出 phase 为 failed/aborted 的运行

提示: 日志文件只记录元数据（不含 prompt/报告正文/工具参数/凭证/路径）。
      子代理会话文件（.jsonl.zstd）含完整事件流，请勿整篇粘贴进聊天，
      只摘录错误事件与关键上下文。
`

// ---------------------------------------------------------------------------
// 路径解析
// ---------------------------------------------------------------------------

function resolveHome(opts) {
  if (opts.home !== undefined) return resolve(opts.home)
  if (process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== '') return resolve(process.env.DSH_HOME)
  return join(homedir(), '.dsh')
}

/** 会话持久化根目录：选项 > $DSH_SESSION_JSONL 推断 > $DSH_HOME/sessions。 */
function resolveSessionsRoot(opts, home) {
  if (opts.sessions !== undefined) return resolve(opts.sessions)
  const current = process.env.DSH_SESSION_JSONL
  if (current !== undefined && current !== '') {
    // <root>/<project>/<session-id>/session.jsonl.zstd -> 上溯三层为 root
    const sessionDir = dirname(current)
    const projectDir = dirname(sessionDir)
    return dirname(projectDir)
  }
  return join(home, 'sessions')
}

/** DSH 的会话 id 路径段编码（移植自 dsh-session-persistence-jsonl/format.ts）。 */
function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty path segment')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i)
    const ch = String.fromCharCode(code)
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

// ---------------------------------------------------------------------------
// Shadow 定义（$DSH_HOME/shadow-minds/*.md 的 YAML frontmatter）
// ---------------------------------------------------------------------------

/** 解析定义文件 frontmatter（键: 值 / 布尔 / 数字 / 字符串列表子集）。 */
function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/u, '') // 去除 BOM
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(normalized)
  if (match === null) return { meta: {}, body: normalized }
  const meta = {}
  let currentListKey
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (line.trim() === '' || line.startsWith('#')) continue
    const item = /^\s*-\s+(.+)$/.exec(line)
    if (item !== null) {
      if (currentListKey === undefined) continue
      meta[currentListKey] ??= []
      meta[currentListKey].push(parseScalar(item[1]))
      continue
    }
    const pair = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line)
    if (pair === null) continue
    currentListKey = undefined
    const [, key, rawValue] = pair
    if (rawValue === '') {
      currentListKey = key // 后续 "- item" 行归入此键
      meta[key] = []
      continue
    }
    meta[key] = parseScalar(rawValue)
  }
  return { meta, body: normalized.slice(match[0].length) }
}

function parseScalar(raw) {
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function loadDefinitions(home) {
  const root = join(home, 'shadow-minds')
  const definitions = new Map()
  let entries = []
  try {
    entries = readdirSync(root).filter(name => name.endsWith('.md'))
  } catch {
    return { definitions, root }
  }
  for (const name of entries) {
    try {
      const path = join(root, name)
      const { meta, body } = parseFrontmatter(readFileSync(path, 'utf8'))
      if (typeof meta.id !== 'string') continue
      definitions.set(meta.id, {
        id: meta.id,
        name: meta.name,
        enabled: meta.enabled,
        debug: meta.debug,
        activationProbability: meta.activation_probability,
        activeForModels: meta.active_for_models,
        runWithModel: meta.run_with_model,
        reasoningEffort: meta.reasoning_effort,
        timeoutSeconds: meta.timeout_seconds,
        tools: meta.tools,
        capture: meta.capture,
        context: meta.context,
        thinkFirst: meta.think_first,
        holdout: meta.holdout,
        prompt: body.trim(),
        file: path,
      })
    } catch {
      warn(`无法解析定义文件 ${join(root, name)}`)
    }
  }
  return { definitions, root }
}

// ---------------------------------------------------------------------------
// Debug 日志索引（$DSH_HOME/shadow-minds/logs/<shadowId>.jsonl）
// ---------------------------------------------------------------------------

/**
 * 解析一行 debug 日志，容忍撕裂写入：去掉 NUL 填充、补上被截断的
 * 未闭合字符串与括号。返回 { record, repaired, corrupt }。
 */
function parseDebugLine(line) {
  const stripped = line.replace(/\u0000+/gu, '').replace(/^\uFEFF/u, '') // 去 NUL 填充与 BOM
  if (stripped.trim() === '') return { record: undefined, repaired: false, corrupt: false }
  try {
    return { record: JSON.parse(stripped), repaired: false, corrupt: false }
  } catch {
    // 试图修复截断行：补未闭合字符串引号，再按括号栈逆序补齐
    let candidate = stripped
    let inString = false
    for (let i = 0; i < candidate.length; i += 1) {
      const ch = candidate[i]
      if (ch === '\\') { i += 1; continue }
      if (ch === '"') inString = !inString
    }
    if (inString) candidate += '"'
    const stack = []
    for (let i = 0; i < candidate.length; i += 1) {
      const ch = candidate[i]
      if (ch === '\\') { i += 1; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{' || ch === '[') stack.push(ch)
      else if (ch === '}' || ch === ']') stack.pop()
    }
    candidate += stack.reverse().map(open => open === '{' ? '}' : ']').join('')
    try {
      return { record: JSON.parse(candidate), repaired: true, corrupt: false }
    } catch {
      return { record: undefined, repaired: false, corrupt: true }
    }
  }
}

function loadDebugLogs(home) {
  const logRoot = join(home, 'shadow-minds', 'logs')
  const records = []
  const corrupt = []
  let files = []
  try {
    files = readdirSync(logRoot).filter(name => name.endsWith('.jsonl'))
  } catch {
    return { records, corrupt, byRun: new Map(), byChild: new Map(), byRoot: new Map(), logRoot, files: [] }
  }
  for (const name of files) {
    const shadowId = name.slice(0, -'.jsonl'.length)
    const lines = readFileSync(join(logRoot, name), 'utf8').split('\n')
    for (let lineNo = 1; lineNo <= lines.length; lineNo += 1) {
      const { record, repaired, corrupt: isCorrupt } = parseDebugLine(lines[lineNo - 1])
      if (record === undefined) {
        if (isCorrupt) {
          corrupt.push({ file: name, lineNo, raw: truncate(lines[lineNo - 1], 120) })
          // 只在 health 里汇报，避免每次 trace/find 刷屏
        }
        continue
      }
      record.__shadowId = record.shadowId ?? shadowId
      record.__file = join(logRoot, name)
      if (repaired) record.__repaired = true
      records.push(record)
    }
  }
  const byRun = new Map()
  const byChild = new Map()
  const byRoot = new Map()
  for (const record of records) {
    for (const [index, key] of [
      [byRun, record.runId],
      [byChild, record.childSessionId],
      [byRoot, record.rootSessionId],
    ]) {
      if (typeof key !== 'string' || key === '') continue
      const bucket = index.get(key)
      if (bucket === undefined) index.set(key, [record])
      else bucket.push(record)
    }
  }
  return { records, corrupt, byRun, byChild, byRoot, logRoot, files }
}

// ---------------------------------------------------------------------------
// 会话文件（zstd 分帧 / 明文 JSONL）解码
// ---------------------------------------------------------------------------

const ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD]

/** 扫描 zstd 帧边界；无帧返回空数组（视为明文）。 */
function scanZstdFrames(buffer) {
  const magic = Buffer.from(ZSTD_MAGIC)
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = buffer.indexOf(magic, offset)
    if (start < 0) break
    const next = buffer.indexOf(magic, start + 4)
    const end = next < 0 ? buffer.length : next
    frames.push({ start, end })
    offset = end
  }
  return frames
}

/** 解码一个会话文件，返回 { header, rows }（rows 为原始 JSON 行对象）。 */
function decodeSessionFile(path) {
  const buffer = readFileSync(path)
  let text
  if (path.endsWith('.zstd')) {
    // Node 的 zstdDecompressSync 对“多帧拼接”文件只解出第一帧，必须逐帧解码。
    const frames = scanZstdFrames(buffer)
    if (frames.length === 0) {
      throw new Error('zstd 帧魔数缺失（文件损坏或并非 zstd 会话日志）')
    }
    const parts = []
    for (const { start, end } of frames) {
      parts.push(zstdDecompressSync(buffer.subarray(start, end)).toString('utf8'))
    }
    text = parts.join('')
  } else {
    text = buffer.toString('utf8')
  }
  const rows = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/^\uFEFF/u, '') // 去除 BOM
    if (line.trim() === '') continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      rows.push({ type: 'unparsed', raw: truncate(line, 200) })
    }
  }
  const header = rows.length > 0 && rows[0].type === 'session' ? rows[0] : undefined
  return { header, rows: header === undefined ? rows : rows.slice(1), rawTextLength: text.length }
}

/** 在会话根目录下按 id 查找会话文件。 */
function findSessionFile(root, id) {
  if (!existsSync(root)) return undefined
  let projects = []
  try {
    projects = readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => join(root, entry.name))
  } catch {
    return undefined
  }
  let segment
  try {
    segment = encodeSegment(id)
  } catch {
    return undefined
  }
  for (const project of projects) {
    for (const suffix of ['.jsonl.zstd', '.jsonl']) {
      const path = join(project, segment, `session${suffix}`)
      if (existsSync(path)) return path
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// 子代理会话摘要（“LLM/接口出了什么问题”的核心证据）
// ---------------------------------------------------------------------------

const STAGE_LABEL = {
  prepare: '构建轨迹投影/校验能力',
  start: '启动子代理',
  run: '子代理执行中',
  dispose: '回收子代理',
  validate: '校验结构化输出',
  relay: '投递报告到根会话',
}

const REASON_LABEL = {
  USER_MESSAGE_RECEIVED: '收到新用户输入，主动取消',
  USER_TURN_ABORTED: '根会话本轮被中止',
  SHADOW_PAUSED: 'Shadow 调度被暂停',
  ROOT_DISPOSED: '根会话被销毁',
  PLUGIN_DISPOSED: '插件被销毁',
  SHADOW_TIMEOUT: '运行超过超时限制',
  HEADLESS_DRAIN_TIMEOUT: '无头排空超时',
  HEADLESS_MAINTENANCE_ABORTED: '无头维护中止',
  STALE_EPOCH: '运行已过期（新一轮用户输入）',
  PROVIDER_ABORTED: '提供方中止（非插件发起）',
  SCHEDULING_FAILED: '调度失败（未进入运行）',
  TRAJECTORY_BUILD_FAILED: '构建轨迹投影失败',
  MODEL_SELECTION_INVALID: '模型选择无效',
  SUBAGENT_START_FAILED: '子代理启动失败',
  SUBAGENT_RESULT_FAILED: '子代理结果读取失败',
  SUBAGENT_DISPOSE_FAILED: '子代理回收失败',
  PROVIDER_ERROR: 'LLM 提供方报错',
  PROVIDER_MAX_TOKENS: 'LLM 提供方达到 token 上限',
  PROVIDER_REFUSAL: 'LLM 提供方拒绝响应',
  PROVIDER_STOPPED: 'LLM 提供方非预期停止',
  INVALID_STRUCTURED_OUTPUT: '结构化输出校验失败',
  STRUCTURED_OUTPUT_MISSING: '未调用 structured_output 工具',
  INVALID_REPORT: '报告内容非法',
  REPORT_DELIVERY_FAILED: '报告投递失败',
  UNKNOWN_FAILURE: '未知失败',
}

const CANCEL_SOURCE_LABEL = {
  'user-input': '用户输入',
  'user-command': '用户命令',
  'root-lifecycle': '根会话生命周期',
  'plugin-lifecycle': '插件生命周期',
  timeout: '超时',
  headless: '无头模式',
  provider: '提供方',
  runtime: '运行时',
}

function eventTypeCounts(rows) {
  const counts = new Map()
  for (const row of rows) {
    const type = row.type ?? '?'
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return counts
}

/** 从打包块行估算 assistant 文本量（字符）。 */
function chunkChars(row) {
  const data = row.data
  if (data === undefined) return 0
  if (Array.isArray(data.texts)) {
    let total = 0
    for (const text of data.texts) if (typeof text === 'string') total += text.length
    return total
  }
  const chunks = data.chunks ?? []
  if (!Array.isArray(chunks)) return 0
  let total = 0
  for (const chunk of chunks) {
    if (typeof chunk?.text === 'string') total += chunk.text.length
  }
  return total
}

/** 压缩 request/header 事件：只保留 provider/model/effort/token 上限与工具数。 */
function compactRequestHeader(data) {
  const config = data?.header?.config ?? data?.config
  if (config === undefined) return data
  const compact = {}
  for (const key of ['provider', 'model', 'reasoningEffort', 'maxTokens']) {
    if (config[key] !== undefined) compact[key] = config[key]
  }
  const tools = data?.header?.tools
  if (Array.isArray(tools)) compact.toolCount = tools.length
  if (data?.reason !== undefined) compact.reason = data.reason
  return compact
}

function summarizeChildSession(path, opts) {
  const { header, rows } = decodeSessionFile(path)
  const summary = {
    file: path,
    header: header === undefined ? undefined : {
      id: header.id,
      createdAt: typeof header.createdAt === 'number' ? new Date(header.createdAt).toISOString() : header.createdAt,
      cwd: header.cwd,
      parentSession: header.parentSession,
      origin: header.origin,
      delegationDepth: header.delegationDepth,
    },
    prompt: undefined,
    descriptor: undefined,
    requestHeaders: [],
    modelSelections: [],
    toolCalls: 0,
    toolCallsByName: {},
    toolErrors: [],
    invalidArgs: [],
    turnEnds: [],
    llmRetries: 0,
    eventCounts: {},
    lastEvents: [],
    tailText: undefined,
  }
  // tool/result 行本身不带工具名：先用 callId 建立名称映射
  const callNames = new Map()
  for (const row of rows) {
    if (row.type === 'tool/call' && row.data?.callId !== undefined && row.data?.name !== undefined) {
      callNames.set(row.data.callId, row.data.name)
    } else if (row.type === 'tool-call-chunks' && row.data?.id !== undefined && row.data?.name !== undefined) {
      callNames.set(row.data.id, row.data.name)
    }
  }
  for (const row of rows) {
    const type = row.type ?? '?'
    if (type === 'user/message') {
      // 两种形态都兼容：data.message.content 与 data.content
      const message = row.data?.message
      const rawContent = Array.isArray(message?.content) ? message.content : row.data?.content
      const text = Array.isArray(rawContent)
        ? rawContent.map(part => typeof part?.text === 'string' ? part.text : '').join('')
        : typeof rawContent === 'string' ? rawContent : undefined
      if (text !== undefined && summary.prompt === undefined) {
        // 保留第一条 user/message（即 shadow 的完整入参 prompt），
        // 后续 user/message 是执行过程中的延续通知
        summary.prompt = {
          chars: text.length,
          head: text.slice(0, 600),
          ...opts.prompt ? { full: text } : {},
        }
      }
    } else if (type === 'subagent/descriptor') {
      summary.descriptor = row.data
    } else if (type === 'request/header') {
      summary.requestHeaders.push(compactRequestHeader(row.data))
    } else if (type === 'model/selection') {
      summary.modelSelections.push(row.data)
    } else if (type === 'tool/call') {
      summary.toolCalls += 1
      const name = row.data?.name ?? '?'
      summary.toolCallsByName[name] = (summary.toolCallsByName[name] ?? 0) + 1
    } else if (type === 'tool/result') {
      const error = row.data?.error
      if (error !== undefined) {
        const callId = row.data?.callId
          ?? row.data?.message?.source?.callId
          ?? row.data?.message?.content?.[0]?.toolCallId
        summary.toolErrors.push({
          name: row.data?.name ?? callNames.get(callId) ?? '?',
          code: error.code,
          message: truncate(typeof error.message === 'string' ? error.message : display(error), 300),
        })
      }
      if (error?.code === 'INVALID_ARGS') {
        const callId = row.data?.callId
          ?? row.data?.message?.source?.callId
          ?? row.data?.message?.content?.[0]?.toolCallId
        summary.invalidArgs.push({ name: row.data?.name ?? callNames.get(callId) ?? '?', seq: row.seq })
      }
    } else if (type === 'turn/end') {
      summary.turnEnds.push({ turn: row.data?.turn, reason: row.data?.reason })
    } else if (type === 'llm/retry' || type === 'llm/retry-started') {
      summary.llmRetries += 1
    }
  }
  summary.eventCounts = Object.fromEntries([...eventTypeCounts(rows).entries()].sort())
  const tail = opts.events > 0 ? rows.slice(-opts.events) : []
  for (const row of tail) {
    const shown = { type: row.type, seq: row.seq, time: typeof row.time === 'number' ? new Date(row.time).toISOString() : row.time }
    const data = row.data
    if (data !== undefined) {
      const clipped = { ...data }
      if (clipped.message?.content !== undefined && !Array.isArray(clipped.message?.content)) {
        clipped.message = { ...clipped.message, content: truncate(display(clipped.message.content), 240) }
      } else if (Array.isArray(clipped.message?.content)) {
        clipped.message = {
          ...clipped.message,
          content: clipped.message.content.map(part => typeof part?.text === 'string'
            ? { ...part, text: truncate(part.text, 240) }
            : part),
        }
      }
      shown.data = clipped
    }
    summary.lastEvents.push(shown)
  }
  const totalChars = rows.reduce((acc, row) => acc + (row.type === 'assistant/chunk'
    ? (typeof row.data?.chunk?.text === 'string' ? row.data.chunk.text.length : 0)
    : chunkChars(row)), 0)
  summary.assistantTextChars = totalChars
  return summary
}

// ---------------------------------------------------------------------------
// 运行时间线组装
// ---------------------------------------------------------------------------

function runTimeline(records) {
  const sorted = [...records].sort((a, b) => String(a.time).localeCompare(String(b.time)))
  const admitted = sorted.find(record => record.event === 'run-admitted')
  const started = sorted.find(record => record.event === 'child-started')
  const finished = sorted.find(record => record.event === 'run-finished')
  const quality = sorted.find(record => record.event === 'quality-metadata')
  const last = sorted.at(-1)
  const runId = admitted?.runId ?? finished?.runId ?? quality?.runId ?? sorted[0]?.runId
  const childSessionId = started?.childSessionId ?? quality?.childSessionId ?? finished?.childSessionId
  const rootSessionId = admitted?.rootSessionId ?? quality?.rootSessionId ?? sorted[0]?.rootSessionId
  return {
    runId,
    shadowId: admitted?.shadowId ?? sorted[0]?.__shadowId,
    childSessionId,
    rootSessionId,
    // 老版本日志可能缺 run-admitted；回退到质量元数据里的同一字段
    capturedThroughSeq: admitted?.capturedThroughSeq ?? quality?.capturedThroughSeq ?? started?.capturedThroughSeq,
    time: admitted?.time ?? sorted[0]?.time,
    events: sorted,
    admitted,
    started,
    finished,
    quality,
    last,
  }
}

// ---------------------------------------------------------------------------
// 输出格式化
// ---------------------------------------------------------------------------

function printTimeline(timeline) {
  console.log(`\n========== Shadow 运行时间线 ==========`)
  console.log(`runId           ${timeline.runId ?? '—'}`)
  console.log(`shadowId        ${timeline.shadowId ?? '—'}`)
  console.log(`rootSessionId   ${timeline.rootSessionId ?? '—'}`)
  console.log(`childSessionId  ${timeline.childSessionId ?? '—'}`)
  console.log(`capturedThroughSeq ${timeline.capturedThroughSeq ?? '—'}（投影到该 seq 为止的根轨迹作为入参窗口）`)
  console.log('')
  for (const record of timeline.events) {
    const event = record.event
    if (event === 'quality-metadata') {
      console.log(`[${isoToLocal(record.time)}] quality-metadata`)
      for (const key of ['stopReason', 'deliberationChars', 'route', 'budgetTier', 'reasoningEffort', 'independence',
        'promptChars', 'timeoutSeconds', 'capture', 'context', 'thinkFirst', 'toolNames']) {
        if (record[key] !== undefined) console.log(`    ${key}: ${display(record[key])}`)
      }
      if (record.error !== undefined) console.log(`    error: ${display(record.error)}`)
      if (record.tools !== undefined) console.log(`    tools: ${display(record.tools)}`)
      continue
    }
    if (event === 'run-finished' || event === 'run-admitted' || event === 'child-started'
      || event === 'run-cancellation-requested' || event === 'report-delivered'
      || event === 'report-delivery-discarded' || event === 'report-delivery-failed'
      || event === 'stagnation') {
      const line = [`[${isoToLocal(record.time)}] ${event}`]
      for (const key of ['phase', 'stage', 'reasonCode', 'cancellationSource', 'providerStopReason', 'relayed', 'action', 'patterns']) {
        if (record[key] !== undefined) line.push(`${key}=${display(record[key])}`)
      }
      if (record.error !== undefined) line.push(`error=${display(record.error.message ?? display(record.error))}`)
      console.log(line.join(' '))
      continue
    }
    console.log(`[${isoToLocal(record.time)}] ${event}`)
  }
  const finished = timeline.finished
  if (finished !== undefined) {
    const stage = finished.stage
    const reason = finished.reasonCode
    const stop = finished.providerStopReason
    console.log('')
    if (stage !== undefined) console.log(`终止阶段: ${stage} — ${STAGE_LABEL[stage] ?? '未知阶段'}`)
    if (reason !== undefined) console.log(`原因码:   ${reason} — ${REASON_LABEL[reason] ?? '未知原因码'}`)
    if (stop !== undefined) console.log(`提供方停止原因: ${stop}`)
    if (finished.cancellationSource !== undefined) {
      console.log(`取消来源: ${finished.cancellationSource} — ${CANCEL_SOURCE_LABEL[finished.cancellationSource] ?? '未知来源'}`)
    }
    if (finished.error !== undefined) {
      console.log(`错误: ${display(finished.error)}`)
      if (finished.error.causes !== undefined) console.log(`错误链: ${display(finished.error.causes)}`)
    }
  }
}

function printDefinitionParams(definition, timeline) {
  if (definition === undefined) {
    console.log(`\n[定义] shadowId 无对应定义文件（可能已被删除，日志仍保留）`)
    return
  }
  console.log(`\n========== 本次运行入参 ==========`)
  console.log(`定义文件:  ${definition.file}`)
  console.log(`名称:      ${display(definition.name)}`)
  console.log(`enabled:   ${display(definition.enabled)}  debug: ${display(definition.debug)}`)
  console.log(`激活概率:  ${display(definition.activationProbability)}`)
  if (definition.activeForModels !== undefined) console.log(`适用模型:  ${display(definition.activeForModels)}`)
  console.log(`模型路由:  ${display(definition.runWithModel ?? '（继承根会话路由）')}`)
  const quality = timeline.quality
  if (quality?.route !== undefined) console.log(`实际路由:  ${quality.route}`)
  if (quality?.budgetTier !== undefined) console.log(`预算档位:  ${quality.budgetTier}${quality.budgetTier === 'frugal' ? '（已切换 frugal 模型）' : ''}`)
  if (quality?.reasoningEffort !== undefined) console.log(`推理强度:  ${display(quality.reasoningEffort)}`)
  if (quality?.independence !== undefined) console.log(`独立性:    ${quality.independence}`)
  // quality-metadata 记录的是请求期有效值，优先于定义文件里的静态配置
  const effectiveTimeout = quality?.timeoutSeconds ?? definition.timeoutSeconds
  console.log(`超时:      ${effectiveTimeout === undefined ? '（全局默认）' : `${effectiveTimeout}s`}`)
  const effectiveCapture = quality?.capture ?? definition.capture
  const effectiveContext = quality?.context ?? definition.context
  const effectiveThinkFirst = quality?.thinkFirst ?? definition.thinkFirst
  console.log(`捕获窗口:  ${display(effectiveCapture)}  上下文: ${display(effectiveContext)}  thinkFirst: ${display(effectiveThinkFirst)}`)
  if (quality?.toolNames !== undefined) {
    console.log(`生效工具:  ${display(quality.toolNames)}（read/grep/glob + 定义额外工具）`)
  } else if (definition.tools !== undefined) {
    console.log(`额外工具:  ${display(definition.tools)}（默认 read/grep/glob 之外）`)
  }
  if (quality?.promptChars !== undefined) console.log(`入参规模:  prompt ${quality.promptChars} 字符`)
  const prompt = definition.prompt
  if (typeof prompt === 'string' && prompt.trim() !== '') {
    console.log(`审查提示词: ${prompt.split('\n').length} 行 / ${prompt.length} 字符（首行: ${truncate(prompt.split('\n')[0], 100)}）`)
  }
}

function printChildSession(summary) {
  console.log(`\n========== 子代理会话（LLM/接口调用证据） ==========`)
  console.log(`会话文件:  ${summary.file}`)
  const header = summary.header
  if (header !== undefined) {
    console.log(`创建时间:  ${header.createdAt ?? '—'}  cwd: ${display(header.cwd)}`)
    console.log(`parent:    ${display(header.parentSession)}  origin: ${display(header.origin)}  depth: ${display(header.delegationDepth)}`)
  } else {
    console.log('（无 session 头行，文件可能损坏）')
  }
  const descriptor = summary.descriptor
  if (descriptor !== undefined) {
    console.log('持久化 descriptor:')
    for (const key of ['version', 'mode', 'provider', 'label', 'agentProvider', 'agentModel', 'agentReasoningEffort', 'toolFilter']) {
      if (descriptor[key] !== undefined) console.log(`    ${key}: ${display(descriptor[key])}`)
    }
  }
  const prompt = summary.prompt
  if (prompt !== undefined) {
    console.log(`prompt: ${prompt.chars} 字符`)
    console.log(`  ┌─ 头部（600 字符）${prompt.full !== undefined ? ' · 完整版见下' : ''} ─`)
    for (const line of prompt.head.split('\n').slice(0, 8)) console.log(`  │ ${line}`)
    console.log(`  └─`)
    if (prompt.full !== undefined) {
      console.log('完整 prompt:')
      console.log(prompt.full)
    }
  }
  const counts = summary.eventCounts
  if (Object.keys(counts).length > 0) console.log(`事件计数: ${Object.entries(counts).map(([type, count]) => `${type}×${count}`).join('  ')}`)
  if (summary.assistantTextChars > 0) console.log(`assistant 文本总量: ${summary.assistantTextChars} 字符`)
  if (Object.keys(summary.toolCallsByName).length > 0) {
    console.log(`工具调用: ${summary.toolCalls} 次 → ${display(summary.toolCallsByName)}`)
  }
  if (summary.toolErrors.length > 0) {
    console.log('工具错误:')
    for (const error of summary.toolErrors) console.log(`    ${display(error.name)} [${display(error.code)}] ${error.message}`)
  }
  if (summary.invalidArgs.length > 0) {
    console.log(`INVALID_ARGS（参数 schema 被拒，模型被要求重试）: ${summary.invalidArgs.length} 次`)
  }
  if (summary.turnEnds.length > 0) {
    console.log(`turn 终止: ${summary.turnEnds.map(end => `turn ${display(end.turn)}/${display(JSON.stringify(end.reason))}`).join(', ')}`)
  }
  if (summary.llmRetries > 0) console.log(`LLM 重试事件: ${summary.llmRetries}`)
  if (summary.requestHeaders.length > 0) {
    console.log(`LLM 请求头（${summary.requestHeaders.length} 次请求）:`)
    for (const header of summary.requestHeaders.slice(0, 8)) console.log(`    ${display(header)}`)
  }
  if (summary.modelSelections.length > 0) {
    console.log('模型选择事件:')
    for (const selection of summary.modelSelections.slice(0, 5)) console.log(`    ${display(selection)}`)
  }
  if (summary.lastEvents.length > 0) {
    console.log(`最后 ${summary.lastEvents.length} 条事件:`)
    for (const event of summary.lastEvents) console.log(`    ${display(event)}`)
  }
}

// ---------------------------------------------------------------------------
// 命令实现
// ---------------------------------------------------------------------------

function cmdHealth(ctx) {
  const { definitions, root } = ctx.definitions
  const { logRoot, files } = ctx.logs
  console.log(`DSH_HOME:      ${ctx.home}`)
  console.log(`会话根目录:    ${ctx.sessionsRoot}（${existsSync(ctx.sessionsRoot) ? '存在' : '不存在'}`)
  if (existsSync(ctx.sessionsRoot)) {
    try {
      const projects = readdirSync(ctx.sessionsRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
      console.log(`  项目目录: ${projects.join(', ') || '（空）'}`)
    } catch {
      console.log('  （不可读）')
    }
  }
  console.log(`定义目录:      ${root}`)
  console.log(`日志目录:      ${logRoot}`)
  if (definitions.size === 0) console.log('  （未找到任何定义文件）')
  console.log('')
  console.log('定义             debug  启用  日志文件                     大小       最后记录时间')
  for (const definition of [...definitions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const logPath = join(logRoot, `${definition.id}.jsonl`)
    let size = '—'
    let lastTime = '—'
    if (existsSync(logPath)) {
      const stat = statSync(logPath)
      size = `${(stat.size / 1024).toFixed(1)} KB`
      const lastLine = readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim() !== '').at(-1)
      const last = parseDebugLine(lastLine ?? '')
      if (last.record !== undefined) {
        lastTime = `${isoToLocal(last.record.time)}${last.repaired ? '（截断修复）' : ''}`
      } else {
        lastTime = '（末行损坏）'
      }
    }
    console.log(`${definition.id.padEnd(24)} ${String(definition.debug ?? false).padEnd(5)}  ${String(definition.enabled ?? true).padEnd(5)}  ${logPath.padEnd(28)} ${size.padEnd(9)} ${lastTime}`)
  }
  for (const file of files) {
    if (!definitions.has(file.slice(0, -'.jsonl'.length))) {
      console.log(`（遗留日志 ${file}：对应定义已被删除，日志仍保留）`)
    }
  }
  if (ctx.logs.corrupt.length > 0) {
    console.log('')
    console.log(`损坏记录 ${ctx.logs.corrupt.length} 条（NUL 填充/截断，疑似写入中断或旧版本崩溃）:`)
    for (const entry of ctx.logs.corrupt.slice(0, 10)) {
      console.log(`    ${entry.file}:${entry.lineNo}  ${entry.raw}`)
    }
  }
  console.log('')
  console.log('提示: 若目标定义 debug: false，则没有运行日志。可在定义 frontmatter 里设置 debug: true 后')
  console.log('      重启/重跑（或在设置页开启），此后每次运行都会追加元数据记录。')
}

function cmdRuns(ctx, opts) {
  const timelineByRun = new Map()
  for (const record of ctx.logs.records) {
    if (record.event !== 'run-admitted') continue
    if (opts.shadow !== undefined && (record.shadowId ?? record.__shadowId) !== opts.shadow) continue
    const key = record.runId
    if (timelineByRun.has(key)) continue
    const bucket = ctx.logs.byRun.get(key) ?? [record]
    const timeline = runTimeline(bucket)
    if (opts.failed && !['failed', 'aborted'].includes(timeline.finished?.phase)) continue
    timelineByRun.set(key, timeline)
  }
  const rows = [...timelineByRun.values()].sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, opts.limit)
  if (opts.json) {
    printJson(rows.map(timeline => ({
      time: timeline.time,
      shadowId: timeline.shadowId,
      runId: timeline.runId,
      childSessionId: timeline.childSessionId,
      rootSessionId: timeline.rootSessionId,
      phase: timeline.finished?.phase,
      stage: timeline.finished?.stage,
      reasonCode: timeline.finished?.reasonCode,
      providerStopReason: timeline.finished?.providerStopReason,
      error: timeline.finished?.error,
      route: timeline.quality?.route,
    })))
    return
  }
  if (rows.length === 0) {
    console.log(opts.shadow !== undefined ? `shadow "${opts.shadow}" 没有运行记录` : '没有运行记录（debug: true 的定义才会落盘）')
    return
  }
  console.log(`${rows.length} 次运行（时间倒序）:`)
  for (const timeline of rows) {
    const finished = timeline.finished
    console.log(`${isoToLocal(timeline.time)}  ${timeline.shadowId ?? '?'}  ${finished?.phase ?? 'running'}`.padEnd(60)
      + `${finished?.reasonCode ?? ''}  ${finished?.providerStopReason ?? ''}`.padEnd(50)
      + `child=${timeline.childSessionId ?? '—'}  run=${timeline.runId}`)
  }
  console.log('')
  console.log('用 `trace <runId 或 childSessionId>` 查看单次运行详情。')
}

function cmdFind(ctx, opts) {
  const text = opts.positional[0]
  if (text === undefined) fail('find 需要一个检索文本')
  const needle = text.toLowerCase()
  const matchedRuns = new Map()
  for (const record of ctx.logs.records) {
    const haystack = [
      record.runId, record.childSessionId, record.rootSessionId, record.shadowId,
      record.event, record.phase, record.stage, record.reasonCode, record.cancellationSource,
      record.providerStopReason, record.stopReason, record.route, record.budgetTier,
      record.error?.message, record.error?.name, record.error?.code,
      ...(record.error?.causes ?? []).flatMap(cause => [cause.message, cause.name, cause.code]),
    ].filter(v => v !== undefined).join(' ').toLowerCase()
    if (!haystack.includes(needle)) continue
    if (opts.shadow !== undefined && (record.shadowId ?? record.__shadowId) !== opts.shadow) continue
    const key = record.runId
    if (key === undefined || matchedRuns.has(key)) continue
    const timeline = runTimeline(ctx.logs.byRun.get(key) ?? [record])
    matchedRuns.set(key, timeline)
  }
  const rows = [...matchedRuns.values()].sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, opts.limit)
  if (opts.json) {
    printJson(rows.map(timeline => ({
      time: timeline.time,
      shadowId: timeline.shadowId,
      runId: timeline.runId,
      childSessionId: timeline.childSessionId,
      rootSessionId: timeline.rootSessionId,
      phase: timeline.finished?.phase,
      reasonCode: timeline.finished?.reasonCode,
      error: timeline.finished?.error ?? timeline.quality?.error,
    })))
    return
  }
  if (rows.length === 0) {
    console.log(`没有记录匹配 "${text}"。`)
    console.log('提示: 若该定义 debug: false 则没有日志；错误文本也可能只出现在子代理会话文件里，')
    console.log('      可先 `runs --failed` 找时间相近的失败运行再 trace。')
    return
  }
  console.log(`匹配 ${rows.length} 次运行:`)
  for (const timeline of rows) {
    const finished = timeline.finished
    console.log(`${isoToLocal(timeline.time)}  ${timeline.shadowId ?? '?'}  ${finished?.phase ?? 'running'}  `
      + `${finished?.reasonCode ?? ''}  child=${timeline.childSessionId ?? '—'}`)
    if (finished?.error !== undefined) console.log(`    错误: ${finished.error.message}`)
  }
  console.log('')
  console.log('用 `trace <childSessionId 或 runId>` 查看单次运行详情。')
}

function cmdTrace(ctx, opts) {
  const id = opts.positional[0]
  if (id === undefined) fail('trace 需要一个 childSessionId / runId / rootSessionId')
  const byRun = ctx.logs.byRun
  const byChild = ctx.logs.byChild
  const byRoot = ctx.logs.byRoot

  const candidates = []
  for (const [kind, bucket] of [['runId', byRun], ['childSessionId', byChild], ['rootSessionId', byRoot]]) {
    const direct = bucket.get(id)
    if (direct !== undefined) candidates.push({ kind, key: id, records: direct })
  }
  // 根会话 id 常带 session- 前缀，子代理 id 不带；互为补充再查一次
  const prefixVariant = id.startsWith('session-') ? id.slice('session-'.length) : `session-${id}`
  for (const [kind, bucket] of [['runId', byRun], ['childSessionId', byChild], ['rootSessionId', byRoot]]) {
    const variant = bucket.get(prefixVariant)
    if (variant !== undefined) candidates.push({ kind, key: prefixVariant, records: variant })
  }
  if (candidates.length === 0) {
    fail(`在 shadow 调试日志中没有找到 id "${id}"。\n`
      + `  可能原因: 1) 该定义 debug: false（先运行 health 确认）\n`
      + `  2) 该 id 是其它东西（试 find 检索或 runs 列表）\n`
      + `  3) 日志已被清理。子代理会话文件本身仍在时，可尝试:\n`
      + `     node tools/shadow-debug.mjs find <childSessionId>`)
  }
  const picked = candidates.find(candidate => candidate.kind === 'runId' || candidate.kind === 'childSessionId')
    ?? candidates[0]
  // 以 runId 为权威桶合并记录：run-admitted 等早期记录不含 childSessionId，
  // 若只按 child 索引取记录会丢失它们，导致时间线不完整。
  let records = picked.records
  if (picked.kind !== 'runId') {
    const runId = records.find(record => typeof record.runId === 'string')?.runId
    const fullBucket = runId === undefined ? undefined : byRun.get(runId)
    if (fullBucket !== undefined) records = fullBucket
  }
  const timeline = runTimeline(records)
  if (opts.json) {
    printJson({
      matchedAs: picked.kind,
      timeline: {
        runId: timeline.runId,
        shadowId: timeline.shadowId,
        childSessionId: timeline.childSessionId,
        rootSessionId: timeline.rootSessionId,
        capturedThroughSeq: timeline.capturedThroughSeq,
        events: timeline.events,
      },
    })
    return
  }
  if (picked.kind === 'rootSessionId') {
    const allRuns = [...byRoot.entries()].filter(([key]) => key === picked.key)
    if (allRuns.length > 0 && allRuns[0][1].length > 0) {
      const runIds = new Set(allRuns[0][1].map(record => record.runId))
      if (runIds.size > 1) {
        console.log(`根会话 ${picked.key} 有 ${runIds.size} 次 shadow 运行，先展示最近一次；`)
        console.log(`可用 trace <runId> 精确查看: ${[...runIds].join(', ')}`)
        console.log('')
      }
    }
  }
  printTimeline(timeline)
  printDefinitionParams(ctx.definitions.definitions.get(timeline.shadowId), timeline)

  // 子代理会话文件
  if (timeline.childSessionId !== undefined) {
    const childFile = findSessionFile(ctx.sessionsRoot, timeline.childSessionId)
    if (childFile === undefined) {
      console.log(`\n[子代理会话] 在 ${ctx.sessionsRoot} 下未找到 ${timeline.childSessionId} 的会话文件`)
      console.log('  （会话可能尚未落盘、根目录配置不同、或已被清理；可用 --sessions 指定根目录）')
    } else {
      try {
        printChildSession(summarizeChildSession(childFile, opts))
      } catch (error) {
        console.log(`\n[子代理会话] 解码失败: ${error.message}`)
      }
    }
  } else {
    console.log('\n[子代理会话] 该运行没有 childSessionId（启动前失败，如 prepare 阶段）')
  }

  // 根会话文件位置（帮助人工回溯投影窗口）
  if (timeline.rootSessionId !== undefined) {
    const rootFile = findSessionFile(ctx.sessionsRoot, timeline.rootSessionId)
    if (rootFile !== undefined) {
      console.log(`\n[根会话] ${rootFile}`)
      if (timeline.capturedThroughSeq !== undefined) {
        console.log(`  投影窗口截至 seq ${timeline.capturedThroughSeq}；该 seq 之前的事件构成 Shadow 的入参轨迹。`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

function main() {
  // 管道被 head/Select-Object 提前关闭时优雅退出，而不是 EPIPE 崩溃
  process.stdout.on('error', (error) => {
    if (error?.code === 'EPIPE') process.exit(0)
    throw error
  })
  const opts = parseArgs(process.argv.slice(2))
  if (opts.command === 'help') {
    console.log(HELP)
    return
  }
  const home = resolveHome(opts)
  const sessionsRoot = resolveSessionsRoot(opts, home)
  const definitions = loadDefinitions(home)
  const logs = loadDebugLogs(home)
  const ctx = { opts, home, sessionsRoot, definitions, logs }
  switch (opts.command) {
    case 'health': return cmdHealth(ctx)
    case 'runs': return cmdRuns(ctx, opts)
    case 'find': return cmdFind(ctx, opts)
    case 'trace': return cmdTrace(ctx, opts)
    default: fail(`未知命令 ${opts.command}`)
  }
}

main()
