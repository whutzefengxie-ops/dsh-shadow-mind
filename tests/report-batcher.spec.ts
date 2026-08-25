import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { ReportBatcher } from '../src/runtime/index.ts'

function report(id: string) {
  return {
    epoch: 1,
    shadowId: id,
    shadowName: id,
    runId: `run-${id}`,
    childSessionId: SessionId(`child-${id}`),
    capturedThroughSeq: 4,
    content: `report-${id}`,
    verdict: 'challenge' as const,
    refs: [],
  }
}

describe('ReportBatcher', () => {
  it('preserves acceptance order in one fixed-window batch', async () => {
    vi.useFakeTimers()
    try {
      const delivered: string[][] = []
      const batcher = new ReportBatcher(() => 50, reports => void delivered.push(reports.map(item => item.shadowId)))
      batcher.add(report('a'))
      batcher.add(report('b'))
      expect(batcher.busy).toBe(true)
      const drained = batcher.drain()
      await vi.advanceTimersByTimeAsync(50)
      await drained
      expect(delivered).toEqual([['a', 'b']])
      expect(batcher.busy).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes immediately and rejects later admission after disposal', async () => {
    vi.useFakeTimers()
    try {
      const delivered: string[][] = []
      const batcher = new ReportBatcher(() => 500, reports => void delivered.push(reports.map(item => item.shadowId)))
      await expect(batcher.flush()).resolves.toBeUndefined()
      batcher.add(report('a'))
      await batcher.flush()
      expect(delivered).toEqual([['a']])
      batcher.add(report('b'))
      await batcher.dispose()
      batcher.add(report('ignored'))
      await vi.runAllTimersAsync()
      expect(delivered).toEqual([['a'], ['b']])
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports asynchronous timer delivery failures through the quiescence barrier', async () => {
    vi.useFakeTimers()
    try {
      const batcher = new ReportBatcher(() => 20, () => {
        throw new Error('destination unavailable')
      })
      batcher.add(report('a'))
      await vi.advanceTimersByTimeAsync(20)
      await expect(batcher.drain()).rejects.toThrow('Shadow report delivery failed')
      await expect(batcher.drain()).resolves.toBeUndefined()

      batcher.add(report('b'))
      await expect(batcher.flush()).rejects.toThrow('Shadow report delivery failed')
      expect(batcher.busy).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
