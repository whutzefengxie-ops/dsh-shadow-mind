import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { buildShadowModelCatalog } from '../src/runtime/model-catalog.ts'

function modelCatalogContext(overrides: {
  models?: (provider: string) => Promise<readonly { id: string; name: string; description?: string }[]>
  resolve?: (provider: string, model: string) => Promise<{
    provider: string
    id: string
    name: string
    reasoning?: {
      efforts: readonly { id: ReasoningEffortId; name: string; description?: string }[]
      defaultEffort?: ReasoningEffortId
    }
  }>
  presets?: () => Promise<readonly { id: string; name?: string }[]>
}) {
  const ctx = new Context()
  ctx.provide('llm', {
    listProviders: () => [
      { id: 'deepseek-official', name: 'DeepSeek Official' },
      { id: 'broken-route', name: 'Broken Route' },
      { id: 'empty-route', name: 'Empty Route' },
    ],
    listModels: async (provider: string) => {
      if (provider === 'broken-route') throw new Error('catalog lookup failed')
      if (provider === 'empty-route') return []
      return overrides.models === undefined ? [{ id: 'deepseek-v4', name: 'DeepSeek V4' }] : overrides.models(provider)
    },
    resolveModelInfo: async (provider: string, model: string) => {
      if (overrides.resolve !== undefined) return overrides.resolve(provider, model)
      return {
        provider,
        id: model,
        name: 'DeepSeek V4',
        reasoning: {
          efforts: [{ id: ReasoningEffortId('low'), name: 'Low' }, { id: ReasoningEffortId('high'), name: 'High' }],
          defaultEffort: ReasoningEffortId('high'),
        },
      }
    },
  })
  ctx.provide('agentPresets', {
    list: () => overrides.presets === undefined
      ? Promise.resolve([{ id: 'standard', name: 'Standard' }, { id: 'bare' }])
      : overrides.presets(),
  })
  return ctx
}

describe('buildShadowModelCatalog', () => {
  it('projects providers, models, and adapter-advertised reasoning efforts', async () => {
    const ctx = modelCatalogContext({})
    const catalog = await buildShadowModelCatalog(ctx)
    expect(catalog.groups).toEqual([{
      id: 'deepseek-official',
      name: 'DeepSeek Official',
      models: [{
        id: 'deepseek-v4',
        name: 'DeepSeek V4',
        reasoning: {
          efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
          defaultEffort: 'high',
        },
      }],
    }])
    expect(catalog.failures).toEqual([{
      id: 'broken-route',
      name: 'Broken Route',
      message: 'catalog lookup failed',
    }])
    expect(catalog.agentPresets).toEqual([
      { id: 'standard', name: 'Standard' },
      { id: 'bare', name: 'bare' },
    ])
  })

  it('drops providers that advertise no models and isolates exact-route failures', async () => {
    const ctx = modelCatalogContext({
      resolve: async () => { throw new Error('metadata unavailable') },
    })
    const catalog = await buildShadowModelCatalog(ctx)
    expect(catalog.groups.map(group => group.id)).toEqual(['deepseek-official'])
    expect(catalog.groups[0]?.models[0]?.reasoning).toBeUndefined()
    expect(catalog.failures.map(failure => failure.id)).toEqual(['broken-route'])
  })

  it('hides the roster when the agent-presets service is absent or broken', async () => {
    const absent = new Context()
    absent.provide('llm', {
      listProviders: () => [],
      listModels: async () => [],
      resolveModelInfo: async () => { throw new Error('unused') },
    })
    expect(await buildShadowModelCatalog(absent)).toEqual({ groups: [], failures: [], agentPresets: [] })

    const broken = modelCatalogContext({
      presets: async () => { throw new Error('preset root unreadable') },
    })
    const catalog = await buildShadowModelCatalog(broken)
    expect(catalog.agentPresets).toEqual([])
    expect(catalog.failures).toContainEqual(expect.objectContaining({ id: '(agent-presets)' }))
    expect(catalog.groups.map(group => group.id)).toEqual(['deepseek-official'])
  })

  it('returns an empty directory when no LLM runtime is mounted', async () => {
    const ctx = new Context()
    expect(await buildShadowModelCatalog(ctx)).toEqual({ groups: [], failures: [], agentPresets: [] })
  })
})
