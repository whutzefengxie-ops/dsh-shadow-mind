import { describe, expect, it } from 'vitest'
import { modelEligible, selectShadows } from '../src/runtime/scheduler.ts'
import type { ShadowDefinition } from '../src/runtime/types.ts'

function definition(id: string, activationProbability = 1): ShadowDefinition {
  return {
    id,
    name: id,
    enabled: true,
    debug: false,
    activationProbability,
    activeForModels: [],
    tools: [],
    prompt: `Review as ${id}.`,
    sourcePath: `/definitions/${id}.md`,
  }
}

function randomFrom(values: readonly number[]): () => number {
  let index = 0
  return () => values[index++] ?? 0
}

describe('Shadow scheduling', () => {
  it('matches model and provider/model globs', () => {
    expect(modelEligible({ ...definition('model'), activeForModels: ['deepseek-*'] }, 'deepseek', 'deepseek-chat'))
      .toBe(true)
    expect(modelEligible({ ...definition('route'), activeForModels: ['deepseek/deepseek-*'] }, 'deepseek', 'deepseek-chat'))
      .toBe(true)
    expect(modelEligible({ ...definition('other'), activeForModels: ['other/*'] }, 'deepseek', 'deepseek-chat'))
      .toBe(false)
    expect(modelEligible(definition('all'), undefined, undefined)).toBe(true)
  })

  it('applies heartbeat, activation, active-id, and capacity gates', () => {
    const definitions = [definition('a'), definition('b', 0), definition('c')]
    expect(selectShadows(definitions, {
      heartbeatProbability: 0,
      availableSlots: 2,
      activeIds: new Set(),
      random: randomFrom([0]),
    })).toEqual([])
    expect(selectShadows(definitions, {
      heartbeatProbability: 1,
      availableSlots: 2,
      activeIds: new Set(['a']),
      random: randomFrom([0, 0, 0]),
    }).map(item => item.id)).toEqual(['c'])
  })

  it('selects an unbiased-size subset when eligible hits exceed capacity', () => {
    const selected = selectShadows(
      [definition('a'), definition('b'), definition('c')],
      {
        heartbeatProbability: 1,
        availableSlots: 2,
        activeIds: new Set(),
        random: randomFrom([0, 0, 0, 0.9, 0]),
      },
    )
    expect(selected).toHaveLength(2)
    expect(new Set(selected.map(item => item.id)).size).toBe(2)
  })
})
