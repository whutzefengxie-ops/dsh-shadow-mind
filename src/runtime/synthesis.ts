/**
 * Conflict selection, literal redaction, and prompt construction for Shadow synthesis.
 * @module @whutzefengxie-ops/dsh-shadow-mind/synthesis
 */

import type { AcceptedShadowReport } from './report-batcher.ts'
import type { ShadowDefinition } from './types.ts'

/** One challenge/confirm pair selected for at most one synthesis run. */
export interface ShadowConflict {
  readonly left: AcceptedShadowReport
  readonly right: AcceptedShadowReport
}

function refsOverlap(left: readonly number[], right: readonly number[]): boolean {
  if (left.length === 0 || right.length === 0) return true
  const rightRefs = new Set(right)
  return left.some(ref => rightRefs.has(ref))
}

/**
 * Select the closest-severity conflict, using higher combined severity as the stable tie-break.
 * @param reports One accepted delivery batch.
 * @returns One conflict or undefined; no batch can request more than one synthesizer.
 */
export function selectShadowConflict(reports: readonly AcceptedShadowReport[]): ShadowConflict | undefined {
  const conflicts: { conflict: ShadowConflict; gap: number; priority: number }[] = []
  for (const [leftIndex, left] of reports.entries()) {
    for (const right of reports.slice(leftIndex + 1)) {
      if (!((left.verdict === 'challenge' && right.verdict === 'confirm')
        || (left.verdict === 'confirm' && right.verdict === 'challenge'))
        || !refsOverlap(left.refs, right.refs)) continue
      const leftSeverity = left.severity ?? 0
      const rightSeverity = right.severity ?? 0
      conflicts.push({
        conflict: { left, right },
        gap: Math.abs(leftSeverity - rightSeverity),
        priority: leftSeverity + rightSeverity,
      })
    }
  }
  conflicts.sort((left, right) => left.gap - right.gap || right.priority - left.priority)
  return conflicts[0]?.conflict
}

/**
 * Replace every owner-side literal without regex interpretation.
 * @param text Model-visible text.
 * @param keys Owner-side literal keys.
 * @returns Text with every literal occurrence replaced.
 */
export function redactHoldoutLiterals(text: string, keys: readonly string[]): string {
  return keys.reduce((redacted, key) => redacted.split(key).join('[redacted holdout]'), text)
}

/**
 * Test whether any owner-side literal survived a model-visible value.
 * @param text Model-visible text.
 * @param keys Owner-side literal keys.
 * @returns Whether at least one literal remains.
 */
export function containsHoldoutLiteral(text: string, keys: readonly string[]): boolean {
  return keys.some(key => text.includes(key))
}

/**
 * Build one bounded synthesis prompt from already-redacted report text.
 * @param definition Synthesizer definition.
 * @param conflict Selected report pair.
 * @param maxChars Complete prompt limit.
 * @returns Complete model-visible prompt.
 */
export function buildSynthesisPrompt(
  definition: ShadowDefinition,
  conflict: ShadowConflict,
  maxChars: number,
): string {
  const report = (label: string, value: AcceptedShadowReport): string => [
    `### ${label}: ${value.shadowName} (${value.shadowId})`,
    `verdict=${value.verdict} severity=${String(value.severity ?? 0)} refs=${JSON.stringify(value.refs)}`,
    value.content,
  ].join('\n')
  const prompt = [
    'Synthesize the conflicting Shadow reports below from their text only; do not claim to have re-verified either report.',
    'Return one report verdict of challenge, gap, or confirm. If the evidence remains near-tied, prefer the higher-severity report.',
    'State which side the synthesis supports and preserve only sequence refs present below.',
    '',
    '## Synthesizer instructions',
    definition.prompt,
    '',
    report('Report A', conflict.left),
    '',
    report('Report B', conflict.right),
  ].join('\n')
  if (maxChars > 0 && prompt.length > maxChars) {
    throw new Error(`Shadow synthesis prompt length ${String(prompt.length)} exceeds maxPromptChars ${String(maxChars)}`)
  }
  return prompt
}
