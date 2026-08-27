import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  buildSynthesisPrompt,
  containsHoldoutLiteral,
  redactHoldoutLiterals,
  selectShadowConflict,
} from '../src/runtime/index.ts'
import type {
  AcceptedShadowReport,
} from '../src/runtime/report-batcher.ts'
import type { ShadowDefinition, ShadowVerdict } from '../src/runtime/index.ts'

function report(
  id: string,
  verdict: ShadowVerdict,
  refs: readonly number[],
  severity?: number,
): AcceptedShadowReport {
  return {
    epoch: 1,
    shadowId: id,
    shadowName: id,
    runId: `run-${id}`,
    childSessionId: SessionId(`child-${id}`),
    capturedThroughSeq: 10,
    content: `${id} finding`,
    verdict,
    ...severity === undefined ? {} : { severity },
    refs,
  }
}

function synthesizer(): ShadowDefinition {
  return {
    id: 'synthesizer',
    name: 'Synthesizer',
    enabled: true,
    debug: false,
    activationProbability: 0,
    activeForModels: [],
    tools: [],
    capture: 'full',
    context: 'minimal',
    thinkFirst: false,
    preFilters: [],
    boostFilters: [],
    boostFactor: 1,
    holdout: false,
    prompt: 'Resolve only the stated disagreement.',
    sourcePath: '/defs/synthesizer.md',
  }
}

describe('Shadow conflict synthesis helpers', () => {
  it('selects one overlapping challenge/confirm pair and uses severity to break near ties', () => {
    const selected = selectShadowConflict([
      report('broad-challenge', 'challenge', [1], 0.9),
      report('broad-confirm', 'confirm', [1], 0.1),
      report('near-challenge', 'challenge', [2], 0.55),
      report('near-confirm', 'confirm', [2], 0.5),
    ])
    expect([selected?.left.shadowId, selected?.right.shadowId]).toEqual([
      'near-challenge', 'near-confirm',
    ])
  })

  it('treats an unanchored side as overlapping and rejects unrelated verdicts or refs', () => {
    expect(selectShadowConflict([
      report('challenge', 'challenge', [], 0.5),
      report('confirm', 'confirm', [7], 0.5),
    ])).toBeDefined()
    expect(selectShadowConflict([
      report('challenge', 'challenge', [1], 0.5),
      report('confirm', 'confirm', [2], 0.5),
      report('gap', 'gap', [1], 0.5),
    ])).toBeUndefined()
  })

  it('uses zero severity defaults and combined severity for equal-gap conflicts', () => {
    const selected = selectShadowConflict([
      report('low-challenge', 'challenge', [1]),
      report('low-confirm', 'confirm', [1]),
      report('high-challenge', 'challenge', [2], 0.8),
      report('high-confirm', 'confirm', [2], 0.8),
    ])
    expect([selected?.left.shadowId, selected?.right.shadowId]).toEqual([
      'high-challenge', 'high-confirm',
    ])
  })

  it('builds a bounded text-only prompt with the explicit severity tie-break', () => {
    const conflict = selectShadowConflict([
      report('challenge', 'challenge', [1], 0.4),
      report('confirm', 'confirm', [1], 0.6),
    ])!
    const prompt = buildSynthesisPrompt(synthesizer(), conflict, 10_000)
    expect(prompt).toContain('from their text only')
    expect(prompt).toContain('prefer the higher-severity report')
    expect(prompt).toContain('challenge finding')
    expect(() => buildSynthesisPrompt(synthesizer(), conflict, 10)).toThrow('maxPromptChars')
    expect(buildSynthesisPrompt(synthesizer(), conflict, 0)).toContain('challenge finding')
    const unspecified = selectShadowConflict([
      report('challenge-default', 'challenge', []),
      report('confirm-default', 'confirm', []),
    ])!
    expect(buildSynthesisPrompt(synthesizer(), unspecified, 10_000)).toContain('severity=0')
  })

  it('redacts every literal occurrence without interpreting regex syntax', () => {
    const keys = ['secret.*', 'TOKEN']
    const redacted = redactHoldoutLiterals('secret.* TOKEN secret.*', keys)
    expect(redacted).toBe('[redacted holdout] [redacted holdout] [redacted holdout]')
    expect(containsHoldoutLiteral(redacted, keys)).toBe(false)
    expect(containsHoldoutLiteral('TOKEN remains', keys)).toBe(true)
  })
})
