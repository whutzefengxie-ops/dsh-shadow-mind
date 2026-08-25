import { describe, expect, it } from 'vitest'
import { detectPatterns } from '../src/runtime/review-window.ts'
import type {
  ReviewEntry,
  ReviewWindowOptions,
} from '../src/runtime/review-window.ts'
import type { ShadowVerdict } from '../src/runtime/index.ts'

const OPTIONS: ReviewWindowOptions = {
  spinningRepeatCount: 3,
  oscillationPeriods: 2,
  noDriftRepeatCount: 3,
  diminishingWindowSize: 5,
  diminishingNoveltyThreshold: 0.4,
}

function entry(index: number, verdict: ShadowVerdict, refs: readonly number[], shadowId = 'reviewer'): ReviewEntry {
  return {
    shadowId,
    runId: `run-${String(index)}`,
    verdict,
    refs,
    capturedThroughSeq: index,
    finishedAt: new Date(index * 1_000).toISOString(),
  }
}

function patterns(entries: readonly ReviewEntry[], options = OPTIONS): string[] {
  return detectPatterns(entries, options).map(detection => detection.pattern)
}

describe('Shadow review-window stagnation detection', () => {
  it('detects a configured suffix of identical envelopes as spinning', () => {
    expect(patterns([
      entry(1, 'gap', [1]),
      entry(2, 'challenge', [2]),
      entry(3, 'challenge', [2]),
      entry(4, 'challenge', [2]),
    ])).toContain('spinning')
  })

  it('detects two alternating periods only on identical refs', () => {
    expect(patterns([
      entry(1, 'challenge', [4]),
      entry(2, 'confirm', [4]),
      entry(3, 'challenge', [4]),
      entry(4, 'confirm', [4]),
    ])).toContain('oscillation')
    expect(patterns([
      entry(1, 'challenge', [4]),
      entry(2, 'confirm', [5]),
      entry(3, 'challenge', [4]),
      entry(4, 'confirm', [5]),
    ])).not.toContain('oscillation')
  })

  it('detects unchanged confirmations as no-drift', () => {
    expect(patterns([
      entry(1, 'confirm', [7]),
      entry(2, 'confirm', [7]),
      entry(3, 'confirm', [7]),
    ])).toContain('no-drift')
    expect(patterns([
      entry(1, 'confirm', [7]),
      entry(2, 'confirm', [7, 8]),
      entry(3, 'confirm', [7, 8, 9]),
    ])).not.toContain('no-drift')
  })

  it('detects a tunable low share of novel envelopes in a full window', () => {
    const entries = [1, 2, 3, 4, 5].map(index => entry(index, 'gap', [1]))
    expect(patterns(entries)).toContain('diminishing')
    expect(patterns(entries, { ...OPTIONS, diminishingNoveltyThreshold: 0.2 }))
      .not.toContain('diminishing')
  })

  it('keeps definition windows independent and reports the triggering run ids', () => {
    const detected = detectPatterns([
      entry(1, 'gap', [1], 'a'),
      entry(2, 'gap', [1], 'b'),
      entry(3, 'gap', [1], 'a'),
      entry(4, 'gap', [1], 'a'),
    ], OPTIONS)
    expect(detected.find(item => item.shadowId === 'a' && item.pattern === 'spinning')?.runIds)
      .toEqual(['run-1', 'run-3', 'run-4'])
    expect(detected.some(item => item.shadowId === 'b')).toBe(false)
  })
})
