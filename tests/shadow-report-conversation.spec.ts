import { describe, expect, it } from 'vitest'
import type {
  ConversationMatch,
  ConversationNodeContext,
  SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  buildShadowReportChatNode,
  projectShadowReport,
} from '../src/client/shadow-report-projection.ts'
import type { ShadowReportMessageSource } from '../src/runtime/protocol.ts'

function context(seq: number, messageId: string, runId: string) {
  const reportSource: ShadowReportMessageSource = {
    kind: 'shadow-report',
    form: 'relay',
    reports: [{
      shadowId: 'reviewer',
      runId,
      childSessionId: `child-${runId}` as SessionId,
      capturedThroughSeq: seq - 1,
    }],
  }
  const content = [{
    type: 'text' as const,
    text: `Background Shadow reports follow.\n\n### Reviewer (reviewer)\nFinding from ${runId}.`,
  }]
  const event = {
    seq,
    time: seq,
    type: 'user/message',
    data: {
      id: messageId,
      content,
      source: reportSource,
    },
  } as ConversationMatch['event']
  const start = {
    event,
    view: undefined,
    role: 'start',
    location: { kind: 'unresolved' },
  } as ConversationMatch
  const state = projectShadowReport(content, reportSource, seq)
  if (state === null) throw new Error('test report must project')
  return {
    key: `shadow-report:${messageId}`,
    kind: 'shadow-mind-report',
    id: messageId,
    matches: [start],
    start,
    state,
    current: new Map(),
  } satisfies ConversationNodeContext<typeof state>
}

describe('Shadow report Conversation projection', () => {
  it('publishes every review batch at its durable relay position', () => {
    const nodes = [
      buildShadowReportChatNode(context(20, 'message-1', 'run-1')),
      buildShadowReportChatNode(context(40, 'message-2', 'run-2')),
    ]

    expect(nodes.map(node => ({ kind: node?.kind, anchorSeq: node?.anchorSeq }))).toEqual([
      { kind: 'shadow-mind-report', anchorSeq: 20 },
      { kind: 'shadow-mind-report', anchorSeq: 40 },
    ])
    expect(nodes.map(node => node?.data)).toMatchObject([
      { reportSeq: 20, reports: [{ runId: 'run-1', content: 'Finding from run-1.' }] },
      { reportSeq: 40, reports: [{ runId: 'run-2', content: 'Finding from run-2.' }] },
    ])
  })
})
