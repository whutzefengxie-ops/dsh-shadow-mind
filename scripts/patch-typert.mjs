// Second maintenance patch: extract the inlined modelCatalog body into a
// shared const and register the modelCatalog Remote invocation/descriptor.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  'src/generated/typert.host.js',
  'src/generated/typert.remote-client.js',
]

const INLINED = `  'modelCatalog': z.object({
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
  'agentPresets': z.array(z.object({
    'id': z.string().readonly(),
    'name': z.string().readonly(),
  })).readonly(),
}).readonly(),`

const BODY = INLINED.slice(`  'modelCatalog': z.object({`.length, -`\n}).readonly(),`.length)
const CONST = `const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema = z.object({${BODY}
}).readonly()`
const REF = `  'modelCatalog': _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema,`

const CATALOG_CONST = `const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_catalog_result$schema = z.object({`

for (const file of files) {
  let text = readFileSync(file, 'utf8')
  if (!text.includes(INLINED)) throw new Error(`${file}: inlined modelCatalog block not found`)
  if (text.includes('modelCatalog_result$schema')) throw new Error(`${file}: const already present`)
  text = text.replace(INLINED, REF)
  text = text.replace(CATALOG_CONST, `${CONST}\n${CATALOG_CONST}`)
  writeFileSync(file, text)
}

const DESCRIPTOR = `    {
      id: '@whutzefengxie-ops/dsh-shadow-mind#shadowMind/modelCatalog',
      service: 'shadowMind',
      namespace: 'shadowMind',
      method: 'modelCatalog',
      implementation: 'modelCatalog',
      invocation: { kind: 'direct' },
      parameters: [
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@whutzefengxie-ops/dsh-shadow-mind/types#ShadowModelCatalog',
        schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema,
      },
      sourceLocation: {"file":"src/runtime/index.ts","line":521,"column":3},
    },
`

const CATALOG_ENTRY_CLOSE = `      sourceLocation: {"file":"src/runtime/index.ts","line":254,"column":9},
    },
`

for (const file of files) {
  let text = readFileSync(file, 'utf8')
  if (text.includes('#shadowMind/modelCatalog')) throw new Error(`${file}: descriptor already present`)
  if (!text.includes(CATALOG_ENTRY_CLOSE)) throw new Error(`${file}: catalog entry not found`)
  text = text.replace(CATALOG_ENTRY_CLOSE, `${CATALOG_ENTRY_CLOSE}${DESCRIPTOR}`)
  writeFileSync(file, text)
}

console.log('descriptors patched')
