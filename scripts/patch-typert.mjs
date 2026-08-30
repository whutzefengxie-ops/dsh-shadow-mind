/**
 * Idempotent structural maintenance for the committed typert artifacts.
 * The standalone repository diverged from the DSH workspace generator (see
 * docs/subagent-binding-and-command-gate-design.zh.md), so the hand-added
 * schema surface is re-applied here against structural anchors, never stale
 * line numbers. The ShadowRunReasonCode wire enum is additionally reconciled
 * against its canonical declaration in src/runtime/types.ts, so a reason code
 * added to the runtime types can never drift from the strict wire codec.
 * `--check` applies every patch in memory and fails on drift, which CI runs
 * through `pnpm run check:typert`.
 *
 * Usage: node scripts/patch-typert.mjs [--check]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = [
  resolve(root, 'src/generated/typert.host.js'),
  resolve(root, 'src/generated/typert.remote-client.js'),
]
const dtsFile = resolve(root, 'src/generated/typert.remote-client.d.ts')
const runtimeSource = resolve(root, 'src/runtime/index.ts')
const typesSource = resolve(root, 'src/runtime/types.ts')
const checkMode = process.argv.includes('--check')

/** Line number (1-based) of the first occurrence of a marker in the runtime source. */
function sourceLine(marker) {
  const text = readFileSync(runtimeSource, 'utf8')
  const index = text.indexOf(marker)
  if (index < 0) throw new Error(`runtime source marker not found: ${marker}`)
  return text.slice(0, index).split('\n').length
}

/**
 * Parse the ShadowRunReasonCode union members from the canonical runtime type.
 * Members are the trailing `| 'VALUE'` lines of the union; the parse stops at
 * the first line that does not continue that shape, so unrelated unions in the
 * same file can never leak in.
 */
function reasonCodeMembers() {
  const lines = readFileSync(typesSource, 'utf8').split('\n')
  const startIndex = lines.findIndex(line => line.startsWith('export type ShadowRunReasonCode ='))
  if (startIndex < 0) throw new Error('ShadowRunReasonCode declaration not found in src/runtime/types.ts')
  const members = []
  for (let index = startIndex + 1; index < lines.length; index++) {
    const match = lines[index].match(/^\s*\| '([A-Z_]+)'$/)
    if (match === null) break
    members.push(match[1])
  }
  if (members.length === 0) throw new Error('ShadowRunReasonCode has no union members')
  return members
}

/** Canonical `_shadowMindReason$schema` enum block for the current reason members. */
function reasonEnum(members) {
  return `const _shadowMindReason$schema = z.enum([\n${members.map(member => `  '${member}',`).join('\n')}\n])`
}

/** Canonical reflected `ShadowRunReasonCode` declaration string for the current members. */
function reasonDeclaration(members) {
  return `"declaration": "export type ShadowRunReasonCode = ${members.map(member => `'${member}'`).join(' | ')};"`
}

const MODEL_CATALOG_CONST = `const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema = z.object({
  'groups': z.array(z.object({
    'id': z.string().readonly(),
    'name': z.string().readonly(),
    'models': z.array(z.object({
      'id': z.string().readonly(),
      'name': z.string().readonly(),
      'description': z.string().readonly().optional(),
      'reasoning': z.object({
        'efforts': z.array(z.object({
          'id': z.string().readonly(),
          'name': z.string().readonly(),
          'description': z.string().readonly().optional(),
        })).readonly(),
        'defaultEffort': z.string().readonly().optional(),
      }).readonly().optional(),
    })).readonly(),
  })).readonly(),
  'failures': z.array(z.object({
    'id': z.string().readonly(),
    'name': z.string().readonly(),
    'message': z.string().readonly(),
  })).readonly(),
}).readonly()`

const MODEL_CATALOG_REF = `  'modelCatalog': _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema,`

/** Canonical descriptor for the modelCatalog remote, with the live source line. */
function modelCatalogDescriptor(line) {
  return `    {
      id: '@whutzefengxie-ops/dsh-shadow-mind#shadowMind/modelCatalog',
      service: 'shadowMind',
      namespace: 'shadowMind',
      method: 'modelCatalog',
      implementation: 'modelCatalog',
      invocation: { kind: 'direct' },
      parameters: [],
      result: {
        mode: 'strict',
        typeSymbol: '@whutzefengxie-ops/dsh-shadow-mind/types#ShadowModelCatalog',
        schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema,
      },
      sourceLocation: {"file":"src/runtime/index.ts","line":${line},"column":3},
    },
`
}

/** Patch one generated JavaScript artifact in memory. */
function patchJs(text) {
  // 1. Canonical modelCatalog schema const (replace any drifted copy, or insert).
  const constPattern = /const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result\$schema = z\.object\(\{[\s\S]*?\n\}\)\.readonly\(\)/
  if (constPattern.test(text)) text = text.replace(constPattern, () => MODEL_CATALOG_CONST)
  else {
    const anchor = 'const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_catalog_result$schema = z.object({'
    if (!text.includes(anchor)) throw new Error('catalog_result schema anchor not found')
    text = text.replace(anchor, `${MODEL_CATALOG_CONST}\n${anchor}`)
  }

  // 2. catalog_result carries the modelCatalog reference.
  text = text.replace(/^(\s*)'modelCatalog': .*,$/mu, MODEL_CATALOG_REF)
  if (!text.includes(MODEL_CATALOG_REF)) throw new Error('catalog_result modelCatalog field anchor not found')

  // 3. Strip any legacy agentPreset fields (the preset binding was removed).
  text = text.replace(/^  'agentPreset': z\.union\(\[z\.literal\(null\), z\.string\(\)\]\)\.readonly\(\),\n/gmu, '')
  text = text.replace(/^  'agentPreset': z\.string\(\)\.readonly\(\)\.optional\(\),\n/gmu, '')

  // 4. Drop the unreferenced legacy V1 status codecs.
  text = text.replace(/const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_(?:pause|resume|status|toggle)_result\$schema = z\.object\(\{[\s\S]*?\n\}\)\n/gu, '')

  // 5b. Normalize the reflected UpdateShadowDefinition declaration (the
  // agent-preset binding was removed; keep the type registry in sync).
  text = text.replace(
    /"declaration": "export type UpdateShadowDefinition = Partial<Omit<CreateShadowDefinition, 'id' \| 'runWithModel' \| 'reasoningEffort' \| 'agentPreset' \| 'timeoutSeconds'>> & \{ readonly runWithModel\?: string \| undefined; readonly reasoningEffort\?: string \| undefined; readonly agentPreset\?: string \| undefined; readonly timeoutSeconds\?: number \| undefined; \};"/u,
    '"declaration": "export type UpdateShadowDefinition = Partial<Omit<CreateShadowDefinition, \'id\' | \'runWithModel\' | \'reasoningEffort\' | \'timeoutSeconds\'>> & { readonly runWithModel?: string | undefined; readonly reasoningEffort?: string | undefined; readonly timeoutSeconds?: number | undefined; };"',
  )

  // 6. Ensure the modelCatalog descriptor exists, canonically.
  const existing = /    \{\n      id: '@whutzefengxie-ops\/dsh-shadow-mind#shadowMind\/modelCatalog',[\s\S]*?\n    \},\n/u
  if (existing.test(text)) {
    text = text.replace(existing, () => modelCatalogDescriptor(sourceLine(`@Remote('modelCatalog')`)))
  } else {
    const anchor = `      sourceLocation: {"file":"src/runtime/index.ts","line":${sourceLine(`@Remote('catalog')`)},"column":3},\n    },\n`
    if (!text.includes(anchor)) throw new Error('catalog descriptor anchor not found')
    text = text.replace(anchor, `${anchor}${modelCatalogDescriptor(sourceLine(`@Remote('modelCatalog')`))}`)
  }
  if (!text.includes("id: '@whutzefengxie-ops/dsh-shadow-mind#shadowMind/modelCatalog'")) {
    throw new Error('modelCatalog descriptor missing after patch')
  }

  // 7. Ensure the retry descriptor exists, canonically, after modelCatalog.
  const retryExisting = /    \{\n      id: '@whutzefengxie-ops\/dsh-shadow-mind#shadowMind\/retry',[\s\S]*?\n    \},\n/u
  const retryDescriptor = `    {
      id: '@whutzefengxie-ops/dsh-shadow-mind#shadowMind/retry',
      service: 'shadowMind',
      namespace: 'shadowMind',
      method: 'retry',
      implementation: 'retry',
      invocation: { kind: 'direct' },
      scope: {
        context: 'agent',
        wire: 'agentId',
      },
      parameters: [
        {
          name: 'agent',
          wire: 'agentId',
          source: 'lookup',
          lookup: 'agent',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_0$schema,
          },
        },
        {
          name: 'runId',
          wire: 'runId',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@whutzefengxie-ops/dsh-shadow-mind#shadowMind/retry:runId',
            schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_1$schema,
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@whutzefengxie-ops/dsh-shadow-mind/types#ShadowMindStatus',
        schema: _shadowMindStatusV2$schema,
      },
      sourceLocation: {"file":"src/runtime/index.ts","line":${sourceLine(`@Remote('retry')`)},"column":3},
    },
`
  const retrySchemas = `const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_0$schema = z.intersection(z.string(), z.unknown())
const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_1$schema = z.string()
`
  if (!text.includes('_deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_0$schema')) {
    text = text.replace('const _shadowMindStage$schema', `${retrySchemas}const _shadowMindStage$schema`)
  }
  if (retryExisting.test(text)) {
    text = text.replace(retryExisting, () => retryDescriptor)
  } else {
    const modelCatalogEnd = /    \{\n      id: '@whutzefengxie-ops\/dsh-shadow-mind#shadowMind\/modelCatalog',[\s\S]*?\n    \},\n/u
    if (!modelCatalogEnd.test(text)) throw new Error('modelCatalog descriptor anchor not found for retry insertion')
    text = text.replace(modelCatalogEnd, match => `${match}${retryDescriptor}`)
  }
  if (!text.includes("id: '@whutzefengxie-ops/dsh-shadow-mind#shadowMind/retry'")) {
    throw new Error('retry descriptor missing after patch')
  }

  // 8. Reconcile the ShadowRunReasonCode wire enum (and the host-side reflected
  // declaration) with the canonical runtime type. This is the strict codec the
  // gateway must accept for every reasonCode a failing run can surface.
  {
    const members = reasonCodeMembers()
    const enumPattern = /const _shadowMindReason\$schema = z\.enum\(\[[\s\S]*?\n\]\)/u
    if (!enumPattern.test(text)) throw new Error('_shadowMindReason$schema anchor not found')
    text = text.replace(enumPattern, () => reasonEnum(members))
    const declarationPattern = /"declaration": "export type ShadowRunReasonCode = [^"]*";/u
    if (declarationPattern.test(text)) {
      text = text.replace(declarationPattern, () => reasonDeclaration(members))
    }
  }

  // 9. Align every descriptor's sourceLocation with the live runtime source.
  const methods = ['catalog', 'modelCatalog', 'saveDefault', 'status', 'cycles', 'pause', 'resume', 'toggle', 'retry']
  for (const method of methods) {
    const line = sourceLine(`@Remote('${method}')`)
    const pattern = new RegExp(`(      method: '${method}',[\\s\\S]*?      sourceLocation: )\\{"file":"src/runtime/index\\.ts","line":\\d+,"column":\\d+\\},`, 'u')
    if (!pattern.test(text)) throw new Error(`descriptor sourceLocation anchor not found: ${method}`)
    text = text.replace(pattern, `$1{"file":"src/runtime/index.ts","line":${line},"column":3},`)
  }
  return text
}

/** Patch the remote-client declaration file. */
function patchDts(text) {
  if (!text.includes('modelCatalog: () => Promise<RemoteResult<ShadowModelCatalog>>')) {
    text = text.replace(
      '    catalog: () => Promise<RemoteResult<ShadowAdministrationSnapshot>>\n',
      '    catalog: () => Promise<RemoteResult<ShadowAdministrationSnapshot>>\n    modelCatalog: () => Promise<RemoteResult<ShadowModelCatalog>>\n',
    )
    text = text.replace(
      "    'shadowMind/catalog': () => Promise<RemoteResult<ShadowAdministrationSnapshot>>\n",
      "    'shadowMind/catalog': () => Promise<RemoteResult<ShadowAdministrationSnapshot>>\n    'shadowMind/modelCatalog': () => Promise<RemoteResult<ShadowModelCatalog>>\n",
    )
  }
  const retryNamespace = '    retry: (agentId: SessionId, runId: string) => Promise<RemoteResult<ShadowMindStatus>>\n'
  const retryMap = "    'shadowMind/retry': (agentId: SessionId, runId: string) => Promise<RemoteResult<ShadowMindStatus>>\n"
  const retryScope = "    'agent:shadowMind/retry': (runId: string) => Promise<RemoteResult<ShadowMindStatus>>\n"
  if (!text.includes(retryNamespace.trim())) {
    text = text.replace(
      '    status: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>\n',
      `    status: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>\n${retryNamespace}`,
    )
    text = text.replace(
      "    'shadowMind/status': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>\n",
      `    'shadowMind/status': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>\n${retryMap}`,
    )
    text = text.replace(
      "    'agent:shadowMind/status': () => Promise<RemoteResult<ShadowMindStatus>>\n",
      `    'agent:shadowMind/status': () => Promise<RemoteResult<ShadowMindStatus>>\n${retryScope}`,
    )
  }
  return text
}

const drifted = []
for (const file of files) {
  const current = readFileSync(file, 'utf8')
  const patched = patchJs(current)
  if (checkMode) {
    if (patched !== current) drifted.push(file)
  } else if (patched !== current) {
    writeFileSync(file, patched)
    console.log(`patched ${file}`)
  }
}
{
  const current = readFileSync(dtsFile, 'utf8')
  const patched = patchDts(current)
  if (checkMode) {
    if (patched !== current) drifted.push(dtsFile)
  } else if (patched !== current) {
    writeFileSync(dtsFile, patched)
    console.log(`patched ${dtsFile}`)
  }
}
if (checkMode) {
  if (drifted.length > 0) {
    console.error(`typert artifacts drifted: ${drifted.join(', ')} — run "node scripts/patch-typert.mjs"`)
    process.exit(1)
  }
  console.log('typert artifacts in sync')
} else {
  console.log('typert artifacts up to date')
}
