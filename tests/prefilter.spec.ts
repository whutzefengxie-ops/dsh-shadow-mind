import { describe, expect, it } from 'vitest'
import { CallId, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  boostPredicates,
  matchesPredicate,
  prefilterPredicates,
} from '../src/runtime/index.ts'
import { resolveSettings } from '../src/runtime/config.ts'
import type {
  PredicateContext,
} from '../src/runtime/prefilter.ts'
import type { ShadowDefinition } from '../src/runtime/index.ts'

function definition(overrides: Partial<ShadowDefinition> = {}): ShadowDefinition {
  return {
    id: 'reviewer',
    name: 'Reviewer',
    enabled: true,
    debug: false,
    activationProbability: 1,
    activeForModels: [],
    tools: [],
    capture: 'full',
    context: 'standard',
    thinkFirst: false,
    preFilters: [],
    boostFilters: [],
    boostFactor: 1,
    holdout: false,
    prompt: 'Review.',
    sourcePath: '/defs/reviewer.md',
    ...overrides,
  }
}

function appendResult(session: Session, index: number, tool: string, failed: boolean, text: string): void {
  const callId = CallId(`call-${String(index)}`)
  const call = session.append('tool/call', {
    turn: 1,
    step: 1,
    callId,
    name: tool,
    arguments: '{}',
  })
  session.append('tool/result', {
    turn: 1,
    step: 1,
    message: createToolResultMessage({
      callId,
      content: [{ type: 'text', text }],
      isError: failed,
    }),
    ...failed ? { error: { name: 'FixtureError', code: 'fixture_failure' } } : {},
  }, { surfaceOp: 'append', sourceEventSeqs: [call.seq] })
}

function context(
  results: readonly { readonly tool: string; readonly failed: boolean; readonly text: string }[],
  settings = resolveSettings(),
): PredicateContext {
  const session = Session.create(SessionId(`prefilter-${String(results.length)}`))
  session.append('turn/start', { turn: 1 })
  results.forEach((result, index) => {
    appendResult(session, index, result.tool, result.failed, result.text)
  })
  const end = session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return { events: session.events, capturedThroughSeq: end.seq, definition: definition(), settings }
}

function appendRelay(
  session: Session,
  index: number,
  verdict: 'challenge' | 'confirm',
  refs?: readonly number[],
  shadowId = 'reviewer',
): void {
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: `report ${String(index)}` }],
    source: {
      kind: 'shadow-report',
      form: 'relay',
      reports: [{
        shadowId,
        runId: `run-${String(index)}`,
        childSessionId: SessionId(`child-${String(index)}`),
        capturedThroughSeq: index,
        verdict,
        ...refs === undefined ? {} : { refs },
      }],
    },
  }), { surfaceOp: 'append' })
}

describe('Shadow scheduling predicates', () => {
  it('identifies turns with no tool work or an authoritative tool failure', () => {
    const empty = context([])
    expect(matchesPredicate(['no-tool-calls'], prefilterPredicates, empty)).toBe('no-tool-calls')
    expect(matchesPredicate(['tool-failure'], prefilterPredicates, empty)).toBeUndefined()

    const failed = context([{ tool: 'read', failed: true, text: 'failure' }])
    expect(matchesPredicate(['tool-failure'], prefilterPredicates, failed)).toBe('tool-failure')
    expect(matchesPredicate(['missing'], prefilterPredicates, failed)).toBeUndefined()
  })

  it('detects misleading success, repeated failure, and long output boost signals', () => {
    const signals = context([
      { tool: 'read', failed: false, text: 'ok' },
      { tool: 'read', failed: true, text: 'first failure' },
      { tool: 'read', failed: true, text: 'second failure' },
      { tool: 'glob', failed: false, text: 'long result' },
    ], resolveSettings({
      repeatedFailureBoostThreshold: 2,
      longOutputBoostChars: 8,
    }))
    expect(matchesPredicate(['misleading-success'], boostPredicates, signals)).toBe('misleading-success')
    expect(matchesPredicate(['repeated-failure'], boostPredicates, signals)).toBe('repeated-failure')
    expect(matchesPredicate(['long-output'], boostPredicates, signals)).toBe('long-output')

    const insufficient = context([
      { tool: 'read', failed: true, text: 'one failure' },
      { tool: 'glob', failed: false, text: 'short' },
    ], resolveSettings({ repeatedFailureBoostThreshold: 2, longOutputBoostChars: 1_000 }))
    expect(matchesPredicate(['repeated-failure'], boostPredicates, insufficient)).toBeUndefined()
    expect(matchesPredicate(['misleading-success'], boostPredicates, insufficient)).toBeUndefined()
    expect(matchesPredicate(['long-output'], boostPredicates, insufficient)).toBeUndefined()
  })

  it('suppresses only a configured run of identical recent report envelopes', () => {
    const session = Session.create(SessionId('prefilter-reports'))
    appendRelay(session, 1, 'challenge', [1])
    appendRelay(session, 2, 'challenge', [1])
    session.append('turn/start', { turn: 1 })
    appendResult(session, 1, 'read', false, 'new result')
    const end = session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    const predicateContext: PredicateContext = {
      events: session.events,
      capturedThroughSeq: end.seq,
      definition: definition(),
      settings: resolveSettings({ lastReportCoversCount: 2 }),
    }
    expect(matchesPredicate(['last-report-covers'], prefilterPredicates, predicateContext))
      .toBe('last-report-covers')

    appendRelay(session, 3, 'confirm', [1])
    const changed = { ...predicateContext, events: session.events, capturedThroughSeq: session.events.at(-1)!.seq }
    expect(matchesPredicate(['last-report-covers'], prefilterPredicates, changed)).toBeUndefined()
    expect(matchesPredicate(
      ['last-report-covers'],
      prefilterPredicates,
      { ...predicateContext, settings: resolveSettings({ lastReportCoversCount: 3 }) },
    )).toBeUndefined()

    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'new task' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    const reset = { ...predicateContext, events: session.events, capturedThroughSeq: session.events.at(-1)!.seq }
    expect(matchesPredicate(['last-report-covers'], prefilterPredicates, reset)).toBeUndefined()
    appendRelay(session, 4, 'challenge', [1])
    appendRelay(session, 5, 'challenge', [1])
    const repeated = { ...predicateContext, events: session.events, capturedThroughSeq: session.events.at(-1)!.seq }
    expect(matchesPredicate(['last-report-covers'], prefilterPredicates, repeated))
      .toBe('last-report-covers')
  })

  it('ignores other Shadows and compares missing refs as empty envelopes', () => {
    const session = Session.create(SessionId('prefilter-missing-refs'))
    appendRelay(session, 1, 'challenge', undefined, 'other-reviewer')
    appendRelay(session, 2, 'challenge')
    appendRelay(session, 3, 'challenge')
    const end = session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    const predicateContext: PredicateContext = {
      events: session.events,
      capturedThroughSeq: end.seq,
      definition: definition(),
      settings: resolveSettings({ lastReportCoversCount: 2 }),
    }
    expect(matchesPredicate(['last-report-covers'], prefilterPredicates, predicateContext))
      .toBe('last-report-covers')
  })

  it('treats an incomplete boundary as tool-free and retains unmatched tool results', () => {
    const incomplete = context([{ tool: 'read', failed: false, text: 'result' }])
    const call = incomplete.events.find(event => event.type === 'tool/call')
    expect(call).toBeDefined()
    expect(matchesPredicate(
      ['no-tool-calls'],
      prefilterPredicates,
      { ...incomplete, capturedThroughSeq: call?.seq ?? -1 },
    )).toBe('no-tool-calls')

    const session = Session.create(SessionId('prefilter-unmatched-result'))
    session.append('turn/start', { turn: 1 })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: CallId('missing-call'),
        content: [{ type: 'text', text: 'long unmatched result' }],
        isError: false,
      }),
    }, { surfaceOp: 'append' })
    const end = session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('turn/start', { turn: 2 })
    const unmatched: PredicateContext = {
      events: session.events,
      capturedThroughSeq: end.seq,
      definition: definition(),
      settings: resolveSettings({ longOutputBoostChars: 1 }),
    }
    expect(matchesPredicate(['no-tool-calls'], prefilterPredicates, unmatched)).toBeUndefined()
    expect(matchesPredicate(['long-output'], boostPredicates, unmatched)).toBe('long-output')
  })
})
