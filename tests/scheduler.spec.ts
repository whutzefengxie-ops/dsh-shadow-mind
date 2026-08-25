import { describe, expect, it } from 'vitest'
import { modelEligible, seededRandom, selectShadows } from '../src/runtime/index.ts'
import type { ShadowDefinition } from '../src/runtime/index.ts'

function shadow(id: string, overrides: Partial<ShadowDefinition> = {}): ShadowDefinition {
  return {
    id,
    name: id,
    enabled: true,
    debug: false,
    activationProbability: 1,
    activeForModels: [],
    tools: [],
    capture: 'full',
    context: 'standard',
    thinkFirst: false,
    preFilters: [],
    boostFilters: [],
    boostFactor: 1,
    holdout: false,
    prompt: 'review',
    sourcePath: `/defs/${id}.md`,
    ...overrides,
  }
}

describe('modelEligible', () => {
  it('matches model and provider/model globs and rejects missing models', () => {
    expect(modelEligible(shadow('all'), undefined, undefined)).toBe(true)
    expect(modelEligible(shadow('m', { activeForModels: ['deepseek-*'] }), 'p', 'deepseek-chat')).toBe(true)
    expect(modelEligible(shadow('bare', { activeForModels: ['deepseek-chat'] }), undefined, 'deepseek-chat')).toBe(true)
    expect(modelEligible(shadow('p', { activeForModels: ['mock/*'] }), 'mock', 'model')).toBe(true)
    expect(modelEligible(shadow('no', { activeForModels: ['other/?'] }), 'mock', 'model')).toBe(false)
    expect(modelEligible(shadow('missing', { activeForModels: ['*'] }), undefined, undefined)).toBe(false)
  })
})

describe('selectShadows', () => {
  it('applies heartbeat once, then definition gates and the slot bound', () => {
    const values = [0.1, 0.9, 0.1]
    const selected = selectShadows([
      shadow('active'),
      shadow('probability', { activationProbability: 0.5 }),
      shadow('disabled', { enabled: false }),
      shadow('second'),
    ], {
      heartbeatProbability: 0.5,
      availableSlots: 2,
      activeIds: new Set(['active']),
      random: () => values.shift() ?? 1,
    })
    expect(selected.map(item => item.id)).toEqual(['second'])
  })

  it('short-circuits a failed heartbeat or absent capacity', () => {
    expect(selectShadows([shadow('a')], {
      heartbeatProbability: 0,
      availableSlots: 1,
      activeIds: new Set(),
      random: () => 0.5,
    })).toEqual([])
    let draws = 0
    expect(selectShadows([shadow('a')], {
      heartbeatProbability: 1,
      availableSlots: 0,
      activeIds: new Set(),
      random: () => { draws += 1; return 0.5 },
    })).toEqual([])
    expect(draws).toBe(1)
  })

  it('samples eligible hits without source-order preference when capacity is scarce', () => {
    const values = [0, 0, 0, 0, 0, 0.9]
    const selected = selectShadows([shadow('a'), shadow('b'), shadow('c')], {
      heartbeatProbability: 1,
      availableSlots: 2,
      activeIds: new Set(),
      random: () => values.shift() ?? 1,
    })
    expect(selected.map(item => item.id)).toEqual(['c', 'b'])
  })

  it('preserves catalog order without selection draws when every hit fits', () => {
    let draws = 0
    const selected = selectShadows([shadow('a'), shadow('b')], {
      heartbeatProbability: 1,
      availableSlots: 2,
      activeIds: new Set(),
      random: () => { draws += 1; return 0 },
    })
    expect(selected.map(item => item.id)).toEqual(['a', 'b'])
    expect(draws).toBe(3)
  })

  it('skips definitions whose model filter does not accept the root route', () => {
    expect(selectShadows([shadow('other', { activeForModels: ['other/*'] })], {
      heartbeatProbability: 1,
      availableSlots: 1,
      activeIds: new Set(),
      provider: 'mock',
      model: 'root',
      random: () => 0,
    })).toEqual([])
  })

  it('provides repeatable seeded draws', () => {
    const left = seededRandom(42)
    const right = seededRandom(42)
    expect([left(), left(), left()]).toEqual([right(), right(), right()])
  })
})
