import { describe, expect, it } from 'vitest'
// @ts-expect-error The generated host contribution is bundled directly and has no declaration file.
import { TYPERT } from '../src/generated/typert.host.js'
import { TYPERT_REMOTE } from '../src/generated/typert.remote-client.js'

const descriptorSets = [
  TYPERT.invocations as typeof TYPERT_REMOTE.descriptors,
  TYPERT_REMOTE.descriptors,
]

describe('Shadow Remote descriptors', () => {
  it('publishes the modelCatalog remote with a strict directory codec', () => {
    const descriptor = TYPERT_REMOTE.descriptors.find(candidate => candidate.method === 'modelCatalog')

    expect(descriptor).toMatchObject({
      service: 'shadowMind',
      namespace: 'shadowMind',
      implementation: 'modelCatalog',
      invocation: { kind: 'direct' },
    })
    if (descriptor?.result.mode !== 'strict') throw new Error('modelCatalog must use a strict result codec')
    const directory = {
      groups: [{
        id: 'deepseek-official',
        name: 'DeepSeek',
        models: [{
          id: 'deepseek-v4',
          name: 'DeepSeek V4',
          reasoning: {
            efforts: [{ id: 'high', name: 'High' }],
            defaultEffort: 'high',
          },
        }],
      }],
      failures: [],
    }
    expect(descriptor.result.schema.parse(directory)).toEqual(directory)
  })

  it('publishes the scoped lifecycle snapshot method', () => {
    const descriptor = TYPERT_REMOTE.descriptors.find(candidate => candidate.method === 'cycles')

    expect(descriptor).toMatchObject({
      service: 'shadowMind',
      namespace: 'shadowMind',
      implementation: 'reviewCycles',
      scope: { context: 'agent', wire: 'agentId' },
    })
    if (descriptor?.result.mode !== 'strict') throw new Error('cycles must use a strict result codec')
    expect(descriptor.result.schema.parse([{
      capturedThroughSeq: 20,
      scheduling: false,
      runs: [{
        runId: 'run-1',
        shadowId: 'reviewer',
        shadowName: 'Reviewer',
        capturedThroughSeq: 20,
        phase: 'aborted',
        stage: 'run',
        startedAt: '2026-08-24T00:00:00.000Z',
        finishedAt: '2026-08-24T00:00:01.000Z',
        reasonCode: 'USER_MESSAGE_RECEIVED',
        cancellationSource: 'user-input',
        providerStopReason: 'aborted',
      }],
    }])).toHaveLength(1)
  })

  it('rejects an unstated cancellation reason at the wire boundary', () => {
    const descriptor = TYPERT_REMOTE.descriptors.find(candidate => candidate.method === 'cycles')
    if (descriptor?.result.mode !== 'strict') throw new Error('cycles must use a strict result codec')
    const schema = descriptor.result.schema
    expect(() => schema?.parse([{
      capturedThroughSeq: 20,
      scheduling: false,
      runs: [{
        runId: 'run-1',
        shadowId: 'reviewer',
        shadowName: 'Reviewer',
        capturedThroughSeq: 20,
        phase: 'aborted',
        stage: 'run',
        startedAt: '2026-08-24T00:00:00.000Z',
        reasonCode: 'SOMETHING_HAPPENED',
      }],
    }])).toThrow()
  })

  it('accepts the degenerate-output watchdog reason at the wire boundary', () => {
    // The watchdog failure the runtime must be able to surface: a strict
    // consumer may not reject it (check:typert reconciles this enum with the
    // ShadowRunReasonCode type, and this assertion pins the acceptance).
    const cycle = {
      capturedThroughSeq: 20,
      scheduling: false,
      runs: [{
        runId: 'run-1',
        shadowId: 'reviewer',
        shadowName: 'Reviewer',
        capturedThroughSeq: 20,
        phase: 'failed',
        stage: 'run',
        startedAt: '2026-08-24T00:00:00.000Z',
        finishedAt: '2026-08-24T00:00:01.000Z',
        reasonCode: 'DEGENERATE_OUTPUT',
        providerStopReason: 'degenerate-output',
      }],
    }
    for (const descriptors of descriptorSets) {
      const descriptor = descriptors.find(candidate => candidate.method === 'cycles')
      if (descriptor?.result.mode !== 'strict') throw new Error('cycles must use a strict result codec')
      expect(descriptor.result.schema.parse([cycle])).toHaveLength(1)
    }
  })

  it('preserves conditioning and quality telemetry across both status codecs', () => {
    const status = {
      paused: false,
      active: [],
      pendingSchedules: 0,
      epoch: 0,
      totalRuns: 1,
      valueLoop: [{ shadowId: 'reviewer', challenges: 1, adopted: 0, rejected: 0, ignored: 1 }],
      spentChars: 320,
      budgetTier: 'frugal',
      cooldowns: [{
        shadowId: 'reviewer',
        until: '2026-08-25T00:01:00.000Z',
        patterns: ['no-drift'],
      }],
      pendingEscalations: ['reviewer'],
      recentReviews: [{
        shadowId: 'reviewer',
        runId: 'run-1',
        verdict: 'challenge',
        refs: [20],
        capturedThroughSeq: 20,
        finishedAt: '2026-08-25T00:00:01.000Z',
      }],
      lastRun: {
        runId: 'run-1',
        shadowId: 'reviewer',
        shadowName: 'Reviewer',
        childSessionId: 'child-1',
        capturedThroughSeq: 20,
        finishedAt: '2026-08-25T00:00:01.000Z',
        outcome: 'report',
        stage: 'relay',
        providerStopReason: 'completed',
        deliberationChars: 128,
        verdict: 'challenge',
        independence: 'independent',
        route: 'deepseek-official/deepseek-v4-flash',
      },
    }

    for (const descriptors of descriptorSets) {
      const descriptor = descriptors.find(candidate => candidate.method === 'status')
      if (descriptor?.result.mode !== 'strict') throw new Error('status must use a strict result codec')
      expect(descriptor.result.schema.parse(status)).toEqual(status)
    }
  })

  it('preserves review conditioning across catalog and the default-definition save', () => {
    const shared = {
      id: 'default',
      name: 'Reviewer',
      enabled: true,
      debug: false,
      activationProbability: 1,
      activeForModels: ['*'],
      tools: ['read'],
      capture: 'since-compaction',
      context: 'minimal',
      thinkFirst: true,
      holdout: false,
      prompt: 'Review the anchored turn.',
    }
    const input = {
      ...shared,
      runWithModel: null,
      reasoningEffort: null,
      timeoutSeconds: null,
    }
    const definition = { ...shared, sourcePath: '/definitions/default.md' }
    const catalog = {
      definitionRoot: '/definitions',
      definitions: [definition],
      diagnostics: [],
      defaultShadowTimeoutSeconds: 600,
      modelCatalog: {
        groups: [{
          id: 'deepseek-official',
          name: 'DeepSeek',
          models: [{
            id: 'deepseek-v4-flash',
            name: 'DeepSeek V4 Flash',
            reasoning: {
              efforts: [{ id: 'high', name: 'High' }],
              defaultEffort: 'high',
            },
          }],
        }],
        failures: [],
      },
    }

    for (const descriptors of descriptorSets) {
      const catalogDescriptor = descriptors.find(candidate => candidate.method === 'catalog')
      if (catalogDescriptor?.result.mode !== 'strict') throw new Error('catalog must use a strict result codec')
      expect(catalogDescriptor.result.schema.parse(catalog)).toEqual(catalog)

      const descriptor = descriptors.find(candidate => candidate.method === 'saveDefault')
      if (descriptor === undefined) throw new Error('saveDefault descriptor is required')
      const parameter = descriptor.parameters[0]
      if (parameter?.codec.mode !== 'strict') throw new Error('saveDefault input must use a strict codec')
      if (descriptor.result.mode !== 'strict') throw new Error('saveDefault result must use a strict codec')
      expect(parameter.codec.schema.parse(input)).toEqual(input)
      expect(descriptor.result.schema.parse(definition)).toEqual(definition)
    }
  })

  it('publishes the manual retry remote with a strict result codec', () => {
    const status = {
      paused: false,
      active: [],
      pendingSchedules: 0,
      epoch: 0,
      totalRuns: 2,
      valueLoop: [],
      spentChars: 0,
      budgetTier: 'standard',
      cooldowns: [],
      pendingEscalations: [],
      recentReviews: [],
    }

    for (const descriptors of descriptorSets) {
      const descriptor = descriptors.find(candidate => candidate.method === 'retry')
      expect(descriptor).toMatchObject({
        service: 'shadowMind',
        namespace: 'shadowMind',
        implementation: 'retry',
        scope: { context: 'agent', wire: 'agentId' },
      })
      if (descriptor === undefined) throw new Error('retry descriptor is required')
      if (descriptor.result.mode !== 'strict') throw new Error('retry must use a strict result codec')
      expect(descriptor.parameters.map(parameter => parameter.name)).toEqual(['agent', 'runId'])
      expect(descriptor.result.schema.parse(status)).toEqual(status)
    }
  })
})
