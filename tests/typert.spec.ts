import { describe, expect, it } from 'vitest'
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
})
