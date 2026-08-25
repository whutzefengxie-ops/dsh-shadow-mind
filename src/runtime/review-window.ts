/** Pure stagnation detection over accepted anchored Shadow envelopes. @module @whutzefengxie-ops/dsh-shadow-mind/review-window */

import type { ShadowReviewStatus } from './types.ts'

/** One accepted report retained in a root's process-local review window. */
export interface ReviewEntry extends ShadowReviewStatus {}

/** Tunable thresholds for every stagnation detector. */
export interface ReviewWindowOptions {
  readonly spinningRepeatCount: number
  readonly oscillationPeriods: number
  readonly noDriftRepeatCount: number
  readonly diminishingWindowSize: number
  readonly diminishingNoveltyThreshold: number
}

/** Named stagnation pattern detected for the latest report of one definition. */
export interface StagnationDetection {
  readonly shadowId: string
  readonly pattern: 'spinning' | 'oscillation' | 'no-drift' | 'diminishing'
  readonly runIds: readonly string[]
}

function refsKey(entry: ReviewEntry): string {
  return JSON.stringify(entry.refs)
}

function envelopeKey(entry: ReviewEntry): string {
  return `${entry.verdict}:${refsKey(entry)}`
}

function suffix(entries: readonly ReviewEntry[], length: number): readonly ReviewEntry[] | undefined {
  return entries.length < length ? undefined : entries.slice(-length)
}

/**
 * Detect every configured pattern ending at each definition's latest entry.
 * @param entries Accepted entries in completion order.
 * @param options Detector thresholds.
 * @returns Stable definition and pattern order.
 */
export function detectPatterns(
  entries: readonly ReviewEntry[],
  options: ReviewWindowOptions,
): StagnationDetection[] {
  const byDefinition = new Map<string, ReviewEntry[]>()
  for (const entry of entries) {
    const own = byDefinition.get(entry.shadowId) ?? []
    own.push(entry)
    byDefinition.set(entry.shadowId, own)
  }
  const detections: StagnationDetection[] = []
  for (const [shadowId, own] of byDefinition) {
    const spinning = suffix(own, options.spinningRepeatCount)
    const spinningFirst = spinning?.[0]
    if (spinning !== undefined && spinningFirst !== undefined
      && spinning.every(entry => envelopeKey(entry) === envelopeKey(spinningFirst))) {
      detections.push({ shadowId, pattern: 'spinning', runIds: spinning.map(entry => entry.runId) })
    }

    const oscillating = suffix(own, options.oscillationPeriods * 2)
    if (oscillating !== undefined) {
      const first = oscillating[0]
      const second = oscillating[1]
      if (first !== undefined && second !== undefined && first.verdict !== second.verdict
        && oscillating.every(entry => refsKey(entry) === refsKey(first))
        && oscillating.every((entry, index) => entry.verdict === (index % 2 === 0
          ? first.verdict
          : second.verdict))) {
        detections.push({ shadowId, pattern: 'oscillation', runIds: oscillating.map(entry => entry.runId) })
      }
    }

    const noDrift = suffix(own, options.noDriftRepeatCount)
    const noDriftFirst = noDrift?.[0]
    if (noDrift !== undefined && noDrift.every(entry => entry.verdict === 'confirm')
      && noDriftFirst !== undefined && noDrift.every(entry => refsKey(entry) === refsKey(noDriftFirst))) {
      detections.push({ shadowId, pattern: 'no-drift', runIds: noDrift.map(entry => entry.runId) })
    }

    const diminishing = suffix(own, options.diminishingWindowSize)
    if (diminishing !== undefined) {
      const seen = new Set<string>()
      let novel = 0
      for (const entry of diminishing) {
        const key = envelopeKey(entry)
        if (seen.has(key)) continue
        seen.add(key)
        novel += 1
      }
      if (novel / diminishing.length < options.diminishingNoveltyThreshold) {
        detections.push({ shadowId, pattern: 'diminishing', runIds: diminishing.map(entry => entry.runId) })
      }
    }
  }
  return detections
}
