import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ShadowReviewCycle } from '../src/runtime/types.ts'
import { ShadowReviewStore } from '../src/client/shadow-review-store.ts'

const sessionId = 'root-session' as SessionId

function cycle(phase: 'running' | 'silent'): ShadowReviewCycle {
  return {
    capturedThroughSeq: 20,
    scheduling: false,
    runs: [{
      runId: 'run-1',
      shadowId: 'reviewer',
      shadowName: 'Reviewer',
      capturedThroughSeq: 20,
      phase,
      stage: phase === 'running' ? 'run' : 'validate',
      startedAt: '2026-08-24T00:00:00.000Z',
      ...phase === 'silent' ? { finishedAt: '2026-08-24T00:00:01.000Z' } : {},
    }],
  }
}

afterEach(() => { vi.useRealTimers() })

describe('Shadow review lifecycle store', () => {
  it('polls only while work is unsettled and stops after a terminal snapshot', async () => {
    vi.useFakeTimers()
    const load = vi.fn()
      .mockResolvedValueOnce([cycle('running')])
      .mockResolvedValueOnce([cycle('silent')])
    const store = new ShadowReviewStore(load)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(sessionId, listener)

    await vi.waitFor(() => { expect(load).toHaveBeenCalledTimes(1) })
    expect(store.snapshot(sessionId)[0]?.runs[0]?.phase).toBe('running')
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() => { expect(load).toHaveBeenCalledTimes(2) })
    expect(store.snapshot(sessionId)[0]?.runs[0]?.phase).toBe('silent')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(load).toHaveBeenCalledTimes(2)

    unsubscribe()
    store.dispose()
  })

  it('deduplicates concurrent subscribers for one session', async () => {
    const load = vi.fn().mockResolvedValue([cycle('silent')])
    const store = new ShadowReviewStore(load)
    const first = store.subscribe(sessionId, () => {})
    const second = store.subscribe(sessionId, () => {})

    await vi.waitFor(() => { expect(load).toHaveBeenCalledTimes(1) })
    first()
    second()
    store.dispose()
  })
})
