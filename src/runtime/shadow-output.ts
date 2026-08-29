/**
 * Shared structured-output contract narrowing for Shadow children.
 *
 * The provider-side JSON Schema cannot express cross-field rules (strictly
 * ascending rendered anchors, verdict required on reports, severity range,
 * report-only fields). The child-side `structured_output` tool enforces this
 * narrowing BEFORE capture so a violation surfaces as INVALID_ARGS and the
 * model retries within the same turn; the runtime applies the same narrowing
 * after completion as a defense-in-depth backstop.
 * @module @whutzefengxie-ops/dsh-shadow-mind/shadow-output
 */

import type { ShadowVerdict } from './types.ts'

/** Narrowed contract accepted by both the child tool and the runtime backstop. */
export type ShadowOutput = {
  readonly status: 'not_relevant' | 'silent'
  readonly content: ''
  readonly refs: readonly []
} | {
  readonly status: 'report'
  readonly content: string
  readonly verdict: ShadowVerdict
  readonly severity?: number
  readonly refs: readonly number[]
}

/** One narrowing outcome: the accepted value, or path-qualified violations. */
export type NarrowedShadowOutput =
  | { readonly value: ShadowOutput }
  | { readonly violations: readonly string[] }

const REPORT_VERDICTS: readonly ShadowVerdict[] = ['challenge', 'gap', 'confirm', 'uncertain']

/** Whether a value can carry property lookups (a plain non-null non-array object). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Apply the cross-field Shadow output contract to one structured value.
 * Every violation is collected so one retry shows the model everything to fix.
 * @param value - the structured value to narrow.
 * @param projectedSeqs - rendered trajectory anchor seqs; `undefined` skips
 *   the rendered-window membership rule for callers without a projection.
 * @returns the accepted narrowed value or the complete violation list.
 */
export function narrowShadowOutput(
  value: unknown,
  projectedSeqs?: ReadonlySet<number>,
): NarrowedShadowOutput {
  if (!isRecord(value)) {
    return { violations: ['structured output must be an object'] }
  }
  const status = value['status']
  const content = value['content']
  const statusValid = status === 'not_relevant' || status === 'silent' || status === 'report'
  const violations: string[] = []
  if (!statusValid) violations.push('status must be "not_relevant", "silent", or "report"')
  if (typeof content !== 'string') violations.push('content must be a string')
  if (status === 'report') {
    if (typeof content === 'string' && content.trim() === '') {
      violations.push('a "report" requires non-empty content')
    }
    const verdict = value['verdict']
    if (!REPORT_VERDICTS.includes(verdict as ShadowVerdict)) {
      violations.push('a "report" requires verdict "challenge", "gap", "confirm", or "uncertain"')
    }
    const severity = value['severity']
    if (severity !== undefined
      && (typeof severity !== 'number' || !Number.isFinite(severity) || severity < 0 || severity > 1)) {
      violations.push('severity must be a finite number from 0 through 1')
    }
    const refs = value['refs']
    if (refs !== undefined && !Array.isArray(refs)) {
      violations.push('refs must be an array of rendered seq values')
    } else if (refs !== undefined && refs.length > 8) {
      violations.push('refs holds at most 8 entries')
    } else if (refs !== undefined) {
      let previous = -1
      refs.forEach((anchor, index) => {
        if (typeof anchor !== 'number' || !Number.isSafeInteger(anchor) || anchor <= 0) {
          violations.push(`refs[${index}] must be a positive integer`)
          return
        }
        if (anchor <= previous) {
          violations.push(`refs must be strictly ascending (refs[${index}] ${anchor} is not greater than the previous anchor ${previous})`)
        }
        if (projectedSeqs !== undefined && !projectedSeqs.has(anchor)) {
          violations.push(`refs[${index}] ${anchor} is not a rendered trajectory seq`)
        }
        previous = anchor
      })
    }
  } else if (statusValid) {
    // Silent/not_relevant never relay body text, so an explanatory content
    // string is tolerated and normalized away instead of failing the run;
    // report-only fields on a non-report status stay a state-machine error.
    if (Object.hasOwn(value, 'verdict')) violations.push('verdict is only allowed with status "report"')
    if (Object.hasOwn(value, 'severity')) violations.push('severity is only allowed with status "report"')
    if (Object.hasOwn(value, 'refs')) violations.push('refs is only allowed with status "report"')
  }
  if (violations.length > 0) return { violations }
  if (status === 'report') {
    return {
      value: {
        status,
        content: content as string,
        verdict: value['verdict'] as ShadowVerdict,
        ...value['severity'] === undefined ? {} : { severity: value['severity'] as number },
        refs: Object.freeze([...(value['refs'] === undefined ? [] : value['refs'] as readonly number[])]),
      },
    }
  }
  return { value: { status: status as 'not_relevant' | 'silent', content: '', refs: [] } }
}
