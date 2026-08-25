/** Deterministic zero-model-cost Shadow scheduling predicates. @module @whutzefengxie-ops/dsh-shadow-mind/prefilter */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ShadowDefinition, ShadowMindSettings } from './types.ts'

/** Inputs shared by skip and boost predicates. */
export interface PredicateContext {
  readonly events: readonly SessionEvent[]
  readonly capturedThroughSeq: number
  readonly definition: ShadowDefinition
  readonly settings: ShadowMindSettings
}

/** One pure deterministic scheduling predicate. */
export type ShadowPredicate = (context: PredicateContext) => boolean

interface ResultFact {
  readonly tool: string
  readonly failed: boolean
  readonly chars: number
}

/** Facts from authoritative tool results in the captured turn. */
function turnResults(context: PredicateContext): ResultFact[] {
  const boundary = context.events.find(event => event.seq === context.capturedThroughSeq)
  if (boundary?.type !== 'turn/end') return []
  const calls = new Map<string, string>()
  const results: ResultFact[] = []
  for (const event of context.events) {
    if (event.seq > context.capturedThroughSeq) break
    if (event.type === 'tool/call' && event.data.turn === boundary.data.turn) {
      calls.set(String(event.data.callId), event.data.name)
      continue
    }
    if (event.type !== 'tool/result' || event.data.turn !== boundary.data.turn) continue
    const block = event.data.message.content[0]
    results.push({
      tool: calls.get(String(block.toolCallId)) ?? 'unknown-tool',
      failed: block.isError === true || event.data.error !== undefined,
      chars: JSON.stringify(block.content).length,
    })
  }
  return results
}

const noToolCalls: ShadowPredicate = context => turnResults(context).length === 0
const toolFailure: ShadowPredicate = context => turnResults(context).some(result => result.failed)

const lastReportCovers: ShadowPredicate = (context) => {
  const reports: { verdict?: unknown; refs?: unknown; capturedThroughSeq: number }[] = []
  for (const event of context.events) {
    if (event.seq > context.capturedThroughSeq) break
    if (event.type === 'user/message' && event.data.source.kind === 'user') {
      reports.length = 0
      continue
    }
    if (event.type !== 'user/message' || event.data.source.kind !== 'shadow-report') continue
    for (const report of event.data.source.reports) {
      if (report.shadowId === context.definition.id) reports.push(report)
    }
  }
  const window = reports.slice(-context.settings.lastReportCoversCount)
  const latest = window.at(-1)
  if (latest === undefined || window.length < context.settings.lastReportCoversCount) return false
  return window.every(report => report.verdict === latest.verdict
    && JSON.stringify(report.refs ?? []) === JSON.stringify(latest.refs ?? []))
}

const repeatedFailure: ShadowPredicate = (context) => {
  const counts = new Map<string, number>()
  for (const result of turnResults(context)) {
    if (!result.failed) continue
    const count = (counts.get(result.tool) ?? 0) + 1
    if (count >= context.settings.repeatedFailureBoostThreshold) return true
    counts.set(result.tool, count)
  }
  return false
}

const misleadingSuccess: ShadowPredicate = (context) => {
  const succeeded = new Set<string>()
  for (const result of turnResults(context)) {
    if (!result.failed) succeeded.add(result.tool)
    else if (succeeded.has(result.tool)) return true
  }
  return false
}

const longOutput: ShadowPredicate = context =>
  turnResults(context).some(result => result.chars >= context.settings.longOutputBoostChars)

/** Predicates that skip a selected definition before any model call. */
export const prefilterPredicates: ReadonlyMap<string, ShadowPredicate> = new Map([
  ['last-report-covers', lastReportCovers],
  ['tool-failure', toolFailure],
  ['no-tool-calls', noToolCalls],
])

/** Predicates that multiply a definition's activation probability. */
export const boostPredicates: ReadonlyMap<string, ShadowPredicate> = new Map([
  ['misleading-success', misleadingSuccess],
  ['repeated-failure', repeatedFailure],
  ['long-output', longOutput],
])

/**
 * Evaluate configured predicate names against one captured turn.
 * @param names Predicate ids in evaluation order.
 * @param registry Predicate implementations by id.
 * @param context Captured turn, definition, and resolved settings.
 * @returns First matching predicate id, or undefined when none match.
 */
export function matchesPredicate(
  names: readonly string[],
  registry: ReadonlyMap<string, ShadowPredicate>,
  context: PredicateContext,
): string | undefined {
  return names.find(name => registry.get(name)?.(context) === true)
}
