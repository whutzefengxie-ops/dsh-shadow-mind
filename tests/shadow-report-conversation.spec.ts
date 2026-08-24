import { describe, expect, it } from 'vitest'
import type {
  ConversationMatch,
  ConversationNodeContext,
  SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  buildShadowReviewChatNode,
  projectReviewRuns,
  projectShadowReports,
  type ShadowMindReviewChatData,
} from '../src/client/shadow-report-projection.ts'
import type { ShadowReportMessageSource } from '../src/runtime/protocol.ts'

function context(capturedThroughSeq: number, reportSeq: number, runId: string) {
  const event = {
    seq: capturedThroughSeq,
    time: capturedThroughSeq,
    type: 'turn/end',
    data: { turn: 1, reason: { kind: 'completed' } },
  } as ConversationMatch['event']
  const start = {
    event,
    view: undefined,
    role: 'start',
    location: { kind: 'unresolved' },
  } as ConversationMatch
  const reportSource: ShadowReportMessageSource = {
    kind: 'shadow-report',
    form: 'relay',
    reports: [{
      shadowId: 'reviewer',
      runId,
      childSessionId: `child-${runId}` as SessionId,
      capturedThroughSeq,
    }],
  }
  const reports = projectShadowReports([{
    type: 'text',
    text: `Background Shadow reports follow.\n\n### Reviewer (reviewer)\n## Finding\n\n- From ${runId}.`,
  }], reportSource, reportSeq)
  if (reports === null) throw new Error('test report must project')
  const state: ShadowMindReviewChatData = { capturedThroughSeq, reports }
  return {
    key: `shadow-review:${capturedThroughSeq}`,
    kind: 'shadow-mind-review',
    id: String(capturedThroughSeq),
    matches: [start],
    start,
    state,
    current: new Map(),
  } satisfies ConversationNodeContext<ShadowMindReviewChatData>
}

describe('Shadow review Conversation projection', () => {
  it('anchors reports to the reviewed root turn rather than the later relay', () => {
    const node = buildShadowReviewChatNode(context(20, 40, 'run-1'))

    expect(node).toMatchObject({ kind: 'shadow-mind-review', anchorSeq: 20 })
    expect(node?.data).toMatchObject({
      capturedThroughSeq: 20,
      reports: [{ runId: 'run-1', relaySeq: 40, content: '## Finding\n\n- From run-1.' }],
    })
  })

  it('gives every completed root turn an independent candidate node', () => {
    const nodes = [
      buildShadowReviewChatNode(context(20, 30, 'run-1')),
      buildShadowReviewChatNode(context(40, 50, 'run-2')),
    ]

    expect(nodes.map(node => node?.anchorSeq)).toEqual([
      20,
      40,
    ])
  })

  it('keeps silent visible without inventing a relay and lets durable Markdown win for reports', () => {
    const silent = {
      runId: 'silent-run',
      shadowId: 'silent-reviewer',
      shadowName: 'Silent Reviewer',
      capturedThroughSeq: 20,
      phase: 'silent' as const,
      stage: 'validate' as const,
      startedAt: '2026-08-24T00:00:00.000Z',
      finishedAt: '2026-08-24T00:00:01.000Z',
    }
    const reportContext = context(20, 40, 'report-run')
    const runs = projectReviewRuns({
      capturedThroughSeq: 20,
      scheduling: false,
      runs: [silent],
    }, reportContext.state.reports)

    expect(runs).toMatchObject([
      { runId: 'silent-run', phase: 'silent' },
      { runId: 'report-run', phase: 'report', content: '## Finding\n\n- From report-run.', relayed: true },
    ])
    expect(runs[0]).not.toHaveProperty('content')
    expect(runs[0]).not.toHaveProperty('relayed')
  })
})
