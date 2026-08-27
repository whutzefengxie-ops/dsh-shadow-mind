import { describe, expect, it } from 'vitest'
import type { ShadowDefinition, ShadowMindSettings } from '../src/runtime/types.ts'
import {
  definitionDraft,
  definitionInput,
  emptyDefinition,
  settingsDraft,
  settingsInput,
  type DefinitionDraft,
  type SettingsDraft,
} from '../src/client/ShadowMindSettingsTab.tsx'

const SETTINGS: ShadowMindSettings = {
  heartbeatProbability: 0.3,
  maxParallelShadows: 2,
  defaultShadowTimeoutSeconds: 120,
  headlessDrainTimeoutSeconds: 180,
  resultBatchWindowMs: 100,
  defaultShadowModel: 'deepseek/deepseek-reasoner',
  defaultReasoningEffort: 'high',
  synthesisModel: 'deepseek/deepseek-reasoner',
  synthesisReasoningEffort: 'medium',
  argumentDisclosure: 'full',
  randomSeed: 42,
  maxPromptChars: 80_000,
  maxReportChars: 12_000,
  preferIndependentVendor: true,
  longOutputBoostChars: 50_000,
  lastReportCoversCount: 2,
  repeatedFailureBoostThreshold: 3,
  valueLoopEnabled: true,
  valueLoopWindowTurns: 2,
  reviewWindowSize: 8,
  spinningRepeatCount: 3,
  oscillationPeriods: 2,
  noDriftRepeatCount: 3,
  diminishingWindowSize: 5,
  diminishingNoveltyThreshold: 0.4,
  stagnationCooldownSeconds: 300,
  stagnationEscalationEnabled: true,
  reasoningEffortLadder: ['low', 'medium', 'high'],
  sessionShadowSoftBudgetChars: 10_000,
  sessionShadowHardBudgetChars: 20_000,
  frugalShadowModel: 'deepseek/deepseek-chat',
  staleReportDecay: 0.5,
  conflictSynthesisEnabled: true,
  conflictSynthesisTimeoutSeconds: 60,
  commandGateEnabled: true,
  commandGateTools: ['pwsh'],
  commandGateScope: 'root-only',
  commandGateDenyPatterns: ['\\bStop-Process\\b'],
  commandGateAllowPatterns: ['^Get-'],
  commandGateProtectedProcesses: ['prod-api'],
  commandGateProtectedServices: ['prod-svc'],
  commandGateContext: 'production machine: never kill prod-api',
  commandGateModel: 'deepseek/deepseek-chat',
  commandGateReasoningEffort: 'low',
  commandGateJudgeTimeoutSeconds: 30,
  commandGateOnJudgeFailure: 'deny',
  commandGateMaxParallel: 1,
  commandGateVerdictTtlSeconds: 120,
}

const DEFINITION: ShadowDefinition = {
  id: 'reviewer',
  name: 'Independent reviewer',
  enabled: false,
  debug: true,
  activationProbability: 0.5,
  activeForModels: ['deepseek/*'],
  runWithModel: 'deepseek/deepseek-reasoner',
  reasoningEffort: 'high',
  timeoutSeconds: 90,
  tools: ['read', 'search'],
  capture: 'since-compaction',
  context: 'minimal',
  thinkFirst: true,
  preFilters: ['long-output'],
  boostFilters: ['repeated-failure'],
  boostFactor: 2,
  holdout: true,
  prompt: 'Review actionable risks.',
  sourcePath: 'C:/dsh/shadow-minds/reviewer.md',
}

describe('Shadow Mind form conversion', () => {
  it('normalizes half-selection trailing-slash routes into inherit on save', () => {
    const settings = settingsInput(settingsDraft({ ...SETTINGS, defaultShadowModel: 'deepseek/' }))
    expect(settings?.defaultShadowModel).toBeUndefined()

    const definition = definitionInput({ ...definitionDraft(DEFINITION), runWithModel: 'deepseek/' })
    expect(definition?.runWithModel).toBeNull()
  })

  it('round-trips the unlimited (zero) prompt and report bounds', () => {
    const unlimited = settingsInput(settingsDraft({ ...SETTINGS, maxPromptChars: 0, maxReportChars: 0 }))
    expect(unlimited?.maxPromptChars).toBe(0)
    expect(unlimited?.maxReportChars).toBe(0)
  })

  it('round-trips complete and defaulted settings drafts', () => {
    expect(settingsInput(settingsDraft(SETTINGS))).toEqual(SETTINGS)

    const defaults = {
      ...SETTINGS,
      argumentDisclosure: 'redacted' as const,
      preferIndependentVendor: false,
      stagnationEscalationEnabled: false,
      conflictSynthesisEnabled: false,
    }
    delete defaults.defaultShadowModel
    delete defaults.defaultReasoningEffort
    delete defaults.randomSeed
    delete defaults.sessionShadowSoftBudgetChars
    delete defaults.sessionShadowHardBudgetChars
    delete defaults.frugalShadowModel
    expect(settingsInput(settingsDraft(defaults))).toEqual(defaults)
  })

  it.each<[string, Partial<SettingsDraft>]>([
    ['missing heartbeat probability', { heartbeatProbability: '' }],
    ['negative heartbeat probability', { heartbeatProbability: '-1' }],
    ['oversized heartbeat probability', { heartbeatProbability: '2' }],
    ['missing parallel limit', { maxParallelShadows: '' }],
    ['fractional parallel limit', { maxParallelShadows: '1.5' }],
    ['zero parallel limit', { maxParallelShadows: '0' }],
    ['missing prompt limit', { maxPromptChars: '' }],
    ['missing report limit', { maxReportChars: '' }],
    ['missing long-output threshold', { longOutputBoostChars: '' }],
    ['missing value-loop window', { valueLoopWindowTurns: '' }],
    ['missing review window', { reviewWindowSize: '' }],
    ['missing diminishing window', { diminishingWindowSize: '' }],
    ['small last-report threshold', { lastReportCoversCount: '1' }],
    ['small repeated-failure threshold', { repeatedFailureBoostThreshold: '1' }],
    ['small spinning threshold', { spinningRepeatCount: '1' }],
    ['small oscillation period', { oscillationPeriods: '1' }],
    ['small no-drift threshold', { noDriftRepeatCount: '1' }],
    ['missing Shadow timeout', { defaultShadowTimeoutSeconds: '' }],
    ['zero Shadow timeout', { defaultShadowTimeoutSeconds: '0' }],
    ['missing drain timeout', { headlessDrainTimeoutSeconds: '' }],
    ['zero drain timeout', { headlessDrainTimeoutSeconds: '0' }],
    ['missing batch window', { resultBatchWindowMs: '' }],
    ['negative batch window', { resultBatchWindowMs: '-1' }],
    ['non-finite random seed', { randomSeed: 'Infinity' }],
    ['missing novelty threshold', { diminishingNoveltyThreshold: '' }],
    ['negative novelty threshold', { diminishingNoveltyThreshold: '-0.1' }],
    ['oversized novelty threshold', { diminishingNoveltyThreshold: '1.1' }],
    ['missing cooldown', { stagnationCooldownSeconds: '' }],
    ['negative cooldown', { stagnationCooldownSeconds: '-1' }],
    ['missing stale-report decay', { staleReportDecay: '' }],
    ['negative stale-report decay', { staleReportDecay: '-0.1' }],
    ['oversized stale-report decay', { staleReportDecay: '1.1' }],
    ['missing synthesis timeout', { conflictSynthesisTimeoutSeconds: '' }],
    ['zero synthesis timeout', { conflictSynthesisTimeoutSeconds: '0' }],
    ['fractional soft budget', { sessionShadowSoftBudgetChars: '1.5' }],
    ['zero soft budget', { sessionShadowSoftBudgetChars: '0' }],
    ['fractional hard budget', { sessionShadowHardBudgetChars: '1.5' }],
    ['zero hard budget', { sessionShadowHardBudgetChars: '0' }],
    ['missing hard budget', { sessionShadowHardBudgetChars: '' }],
    ['missing frugal route', { frugalShadowModel: '' }],
    ['reversed budgets', { sessionShadowSoftBudgetChars: '20000', sessionShadowHardBudgetChars: '10000' }],
    ['frugal route without soft budget', { sessionShadowSoftBudgetChars: '' }],
    ['empty effort ladder', { reasoningEffortLadder: '' }],
    ['duplicate effort ladder', { reasoningEffortLadder: 'low\nlow' }],
    ['short review window', { reviewWindowSize: '4' }],
  ])('rejects %s', (_name, changes) => {
    expect(settingsInput({ ...settingsDraft(SETTINGS), ...changes })).toBeUndefined()
  })

  it('normalizes complete and minimal Shadow definitions', () => {
    expect(definitionInput(definitionDraft(DEFINITION))).toEqual({
      ...DEFINITION,
      sourcePath: undefined,
    })

    const minimal = {
      ...emptyDefinition(),
      id: 'architect',
      name: ' Architect ',
      prompt: ' Review architecture. ',
      activeForModels: ' deepseek/* \r\n\n openai/* ',
    }
    expect(definitionInput(minimal)).toMatchObject({
      id: 'architect',
      name: 'Architect',
      prompt: 'Review architecture.',
      activeForModels: ['deepseek/*', 'openai/*'],
      runWithModel: null,
      reasoningEffort: null,
      timeoutSeconds: null,
    })
  })

  it.each<[string, Partial<DefinitionDraft>]>([
    ['invalid id', { id: 'Bad id' }],
    ['empty name', { name: ' ' }],
    ['empty prompt', { prompt: ' ' }],
    ['missing probability', { activationProbability: '' }],
    ['negative probability', { activationProbability: '-1' }],
    ['oversized probability', { activationProbability: '2' }],
    ['missing boost', { boostFactor: '' }],
    ['small boost', { boostFactor: '0.5' }],
    ['non-finite timeout', { timeoutSeconds: 'Infinity' }],
    ['zero timeout', { timeoutSeconds: '0' }],
  ])('rejects a definition with %s', (_name, changes) => {
    expect(definitionInput({ ...definitionDraft(DEFINITION), ...changes })).toBeUndefined()
  })
})
