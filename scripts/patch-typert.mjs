/**
 * Idempotent structural maintenance for the committed typert artifacts.
 * The standalone repository diverged from the DSH workspace generator (see
 * docs/subagent-binding-and-command-gate-design.zh.md), so the hand-added
 * schema surface is re-applied here against structural anchors, never stale
 * line numbers. `--check` applies every patch in memory and fails on drift,
 * which CI runs through `pnpm run check:typert`.
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
const checkMode = process.argv.includes('--check')

/** Line number (1-based) of the first occurrence of a marker in the runtime source. */
function sourceLine(marker) {
  const text = readFileSync(runtimeSource, 'utf8')
  const index = text.indexOf(marker)
  if (index < 0) throw new Error(`runtime source marker not found: ${marker}`)
  return text.slice(0, index).split('\n').length
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

  // 4. Gate counters in the status V2 codec: strip any drifted copies first,
  // then insert the canonical four right after synthesisFailures.
  const counters = `  'synthesisFailures': z.number().readonly(),
  'gateDenies': z.number().readonly(),
  'gateAllows': z.number().readonly(),
  'gateJudgeRuns': z.number().readonly(),
  'gateJudgeFailures': z.number().readonly(),`
  if (!text.includes(`  'synthesisFailures': z.number().readonly(),`)) {
    throw new Error('status V2 schema anchor not found (synthesisFailures)')
  }
  text = text.replace(/(  'synthesisFailures': z\.number\(\)\.readonly\(\),\n)(?:  'gate(?:Denies|Allows|JudgeRuns|JudgeFailures)': z\.number\(\)\.readonly\(\),\n)*/gu, '$1')
  text = text.replace(`  'synthesisFailures': z.number().readonly(),`, counters)

  // 5. Drop the unreferenced legacy V1 status codecs.
  text = text.replace(/const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_(?:pause|resume|status|toggle)_result\$schema = z\.object\(\{[\s\S]*?\n\}\)\n/gu, '')

  // 6. Align every descriptor's sourceLocation with the live runtime source.
  const methods = ['catalog', 'modelCatalog', 'create', 'update', 'setEnabled', 'delete', 'status', 'cycles', 'pause', 'resume', 'toggle']
  for (const method of methods) {
    const line = sourceLine(`@Remote('${method}')`)
    const pattern = new RegExp(`(      method: '${method}',[\\s\\S]*?      sourceLocation: )\\{"file":"src/runtime/index\\.ts","line":\\d+,"column":\\d+\\},`, 'u')
    if (!pattern.test(text)) throw new Error(`descriptor sourceLocation anchor not found: ${method}`)
    text = text.replace(pattern, `$1{"file":"src/runtime/index.ts","line":${line},"column":3},`)
  }

  // 7. Ensure the modelCatalog descriptor exists, canonically.
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
