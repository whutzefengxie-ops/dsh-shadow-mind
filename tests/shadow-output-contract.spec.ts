import { describe, expect, it } from 'vitest'
import { narrowShadowOutput } from '../src/runtime/shadow-output.ts'

const SEQS = new Set([15, 2451, 6234, 33217, 65620, 15675])

function violationsOf(value: unknown, seqs?: ReadonlySet<number>): readonly string[] {
  const narrowed = narrowShadowOutput(value, seqs)
  expect(narrowed).toHaveProperty('violations')
  return (narrowed as { violations: readonly string[] }).violations
}

describe('narrowShadowOutput', () => {
  it('accepts a complete report with ascending rendered refs', () => {
    expect(narrowShadowOutput({
      status: 'report',
      content: 'The anchored claim needs correction.',
      verdict: 'challenge',
      severity: 0.5,
      refs: [15, 6234, 65620],
    }, SEQS)).toEqual({
      value: {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        severity: 0.5,
        refs: [15, 6234, 65620],
      },
    })
  })

  it('accepts a report without severity and refs', () => {
    expect(narrowShadowOutput({
      status: 'report',
      content: 'Finding.',
      verdict: 'uncertain',
    }, SEQS)).toEqual({
      value: { status: 'report', content: 'Finding.', verdict: 'uncertain', refs: [] },
    })
  })

  it('normalizes a non-report status away, tolerating its body text', () => {
    expect(narrowShadowOutput({
      status: 'silent',
      content: 'Nothing actionable here.',
    }, SEQS)).toEqual({
      value: { status: 'silent', content: '', refs: [] },
    })
  })

  it('rejects the shipped non-ascending payload and names the violation', () => {
    const violations = violationsOf({
      status: 'report',
      content: 'Finding.',
      verdict: 'challenge',
      refs: [15675, 15],
    }, SEQS)
    expect(violations.join('; ')).toContain('strictly ascending')
    expect(violations.join('; ')).toContain('refs[1] 15')
  })

  it('rejects a ref outside the rendered window only when the window is known', () => {
    const payload = {
      status: 'report',
      content: 'Finding.',
      verdict: 'challenge',
      refs: [999999],
    }
    const violations = violationsOf(payload, SEQS)
    expect(violations.join('; ')).toContain('not a rendered trajectory seq')
    expect(narrowShadowOutput(payload)).toHaveProperty('value')
  })

  it('rejects refs that are duplicated, descending, non-integer, or oversized', () => {
    expect(violationsOf({
      status: 'report', content: 'Finding.', verdict: 'gap', refs: [15, 15],
    }, SEQS).join('; ')).toContain('strictly ascending')
    expect(violationsOf({
      status: 'report', content: 'Finding.', verdict: 'gap', refs: [6234, 2451],
    }, SEQS).join('; ')).toContain('strictly ascending')
    expect(violationsOf({
      status: 'report', content: 'Finding.', verdict: 'gap', refs: [1.5],
    }, SEQS).join('; ')).toContain('refs[0] must be a positive integer')
    expect(violationsOf({
      status: 'report', content: 'Finding.', verdict: 'gap', refs: [15, 2451, 6234, 33217, 65620, 15675, 15, 2451, 6234],
    }, SEQS).join('; ')).toContain('at most 8 entries')
  })

  it('rejects a report missing verdict or with blank content', () => {
    expect(violationsOf({
      status: 'report', content: 'Finding.', refs: [15],
    }, SEQS).join('; ')).toContain('requires verdict')
    expect(violationsOf({
      status: 'report', content: '   ', verdict: 'confirm', refs: [15],
    }, SEQS).join('; ')).toContain('non-empty content')
  })

  it('rejects severity outside 0 through 1', () => {
    for (const severity of [5, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(violationsOf({
        status: 'report', content: 'Finding.', verdict: 'confirm', severity, refs: [15],
      }, SEQS).join('; ')).toContain('severity must be a finite number from 0 through 1')
    }
  })

  it('rejects report-only fields carried on a non-report status', () => {
    for (const extra of [{ verdict: 'confirm' }, { severity: 0.5 }, { refs: [15] }]) {
      const violations = violationsOf({ status: 'not_relevant', content: '', ...extra }, SEQS)
      expect(violations.join('; ')).toContain('only allowed with status "report"')
    }
  })

  it('rejects a non-object value and an invalid status', () => {
    expect(violationsOf('report').join('; ')).toContain('must be an object')
    expect(violationsOf({
      status: 'Report', content: 'Finding.',
    }, SEQS).join('; ')).toContain('status must be')
  })
})
