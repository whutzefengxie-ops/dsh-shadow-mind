import { describe, expect, it } from 'vitest'
import type { ShadowDefinition } from '../src/runtime/types.ts'
import { DEFAULT_SHADOW_ID } from '../src/runtime/types.ts'
import {
  definitionDraft,
  definitionInput,
  toActivationPercent,
  type DefinitionDraft,
} from '../src/client/ShadowMindSettingsTab.tsx'

const DEFINITION: ShadowDefinition = {
  id: DEFAULT_SHADOW_ID,
  name: 'Independent reviewer',
  enabled: false,
  debug: true,
  activationProbability: 0.7,
  activeForModels: ['deepseek/*'],
  runWithModel: 'deepseek/deepseek-reasoner',
  reasoningEffort: 'high',
  timeoutSeconds: 90,
  tools: ['read', 'search'],
  capture: 'since-compaction',
  context: 'minimal',
  thinkFirst: true,
  holdout: false,
  prompt: 'Review actionable risks.',
  sourcePath: 'C:/dsh/shadow-minds/default.md',
}

describe('Shadow definition form conversion', () => {
  it('snaps stored probabilities onto the 10% slider steps', () => {
    expect(toActivationPercent(0.7)).toBe(70)
    expect(toActivationPercent(0.33)).toBe(30)
    expect(toActivationPercent(0)).toBe(10)
    expect(toActivationPercent(1)).toBe(100)
  })

  it('normalizes half-selection trailing-slash routes into inherit on save', () => {
    const definition = definitionInput({ ...definitionDraft(DEFINITION), runWithModel: 'deepseek/' })
    expect(definition?.runWithModel).toBeNull()
  })

  it('round-trips a complete default Shadow definition', () => {
    expect(definitionInput(definitionDraft(DEFINITION))).toEqual({
      id: DEFAULT_SHADOW_ID,
      name: DEFINITION.name,
      enabled: DEFINITION.enabled,
      debug: DEFINITION.debug,
      activationProbability: 0.7,
      activeForModels: ['deepseek/*'],
      runWithModel: 'deepseek/deepseek-reasoner',
      reasoningEffort: 'high',
      timeoutSeconds: 90,
      tools: ['read', 'search'],
      capture: 'since-compaction',
      context: 'minimal',
      thinkFirst: true,
      holdout: false,
      prompt: 'Review actionable risks.',
    })
  })

  it('normalizes a minimal draft', () => {
    const minimal: DefinitionDraft = {
      name: ' Reviewer ',
      enabled: true,
      debug: false,
      activationPercent: 40,
      activeForModels: ' deepseek/* \r\n\n openai/* ',
      runWithModel: '',
      reasoningEffort: ' ',
      timeoutSeconds: '',
      tools: '',
      capture: 'full',
      context: 'standard',
      thinkFirst: false,
      holdout: false,
      prompt: ' Review architecture. ',
    }
    expect(definitionInput(minimal)).toMatchObject({
      id: DEFAULT_SHADOW_ID,
      name: 'Reviewer',
      prompt: 'Review architecture.',
      activationProbability: 0.4,
      activeForModels: ['deepseek/*', 'openai/*'],
      runWithModel: null,
      reasoningEffort: null,
      timeoutSeconds: null,
      tools: [],
    })
  })

  it.each<[string, Partial<DefinitionDraft>]>([
    ['empty name', { name: ' ' }],
    ['empty prompt', { prompt: ' ' }],
    ['non-finite timeout', { timeoutSeconds: 'Infinity' }],
    ['zero timeout', { timeoutSeconds: '0' }],
    ['negative timeout', { timeoutSeconds: '-5' }],
  ])('rejects a definition with %s', (_name, changes) => {
    expect(definitionInput({ ...definitionDraft(DEFINITION), ...changes })).toBeUndefined()
  })
})
