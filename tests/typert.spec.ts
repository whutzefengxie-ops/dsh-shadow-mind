import { describe, expect, it } from 'vitest'
// @ts-expect-error The generated host contribution is bundled directly and has no declaration file.
import { TYPERT } from '../src/generated/typert.host.js'
import { TYPERT_REMOTE } from '../src/generated/typert.remote-client.js'

describe('Shadow Remote descriptors', () => {
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

  it('preserves conditioning and quality telemetry across both status codecs', () => {
    const status = {
      paused: false,
      active: [],
      pendingSchedules: 0,
      epoch: 0,
      totalRuns: 1,
      prefilterSkips: 2,
      effectiveProbabilities: [{ shadowId: 'reviewer', probability: 1 }],
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
      synthesisRuns: 1,
      synthesisFailures: 1,
      lastSynthesisFailure: 'timeout',
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

    const descriptorSets = [
      TYPERT.invocations as typeof TYPERT_REMOTE.descriptors,
      TYPERT_REMOTE.descriptors,
    ]
    for (const descriptors of descriptorSets) {
      const descriptor = descriptors.find(candidate => candidate.method === 'status')
      if (descriptor?.result.mode !== 'strict') throw new Error('status must use a strict result codec')
      expect(descriptor.result.schema.parse(status)).toEqual(status)
    }
  })
})
