import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'
import {
  buildShadowReviewChatNode,
  projectShadowReports,
  type ShadowMindReviewChatData,
  type ShadowMindRelayMarkerData,
} from './shadow-report-projection.ts'

/** Anchor one candidate review row where its root turn completed and fold a later relay into it. */
export const shadowReviewDefinition: ConversationNodeDefinition<ShadowMindReviewChatData> = {
  kind: 'shadow-mind-review',
  target: 'chat',
  match: (event) => {
    if (event.type === 'turn/end' && event.data.reason.kind === 'completed') {
      return { id: String(event.seq), role: 'start' }
    }
    if (event.type !== 'user/message'
      || !isAppendSurfaceEvent(event)
      || event.data.source.kind !== 'shadow-report') return null
    const captured = event.data.source.reports[0]?.capturedThroughSeq
    if (captured === undefined
      || event.data.source.reports.some(report => report.capturedThroughSeq !== captured)) return null
    return { id: String(captured), role: 'update' }
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/end') {
      throw new Error('shadow-mind-review start requires a completed turn/end')
    }
    return { capturedThroughSeq: match.event.seq, reports: [] }
  },
  update: (context, match) => {
    if (match.event.type !== 'user/message' || match.event.data.source.kind !== 'shadow-report') {
      return context.state
    }
    const reports = projectShadowReports(match.event.data.content, match.event.data.source, match.event.seq)
    return reports === null ? context.state : { ...context.state, reports }
  },
  buildViewNode: buildShadowReviewChatNode,
}

/** Retain one zero-height node beside a relay so CSS can suppress its generic Context row. */
export const shadowRelayMarkerDefinition: ConversationNodeDefinition<ShadowMindRelayMarkerData> = {
  kind: 'shadow-mind-relay-marker',
  target: 'chat',
  match: event => event.type === 'user/message'
    && isAppendSurfaceEvent(event)
    && event.data.source.kind === 'shadow-report'
    ? { id: String(event.data.id), role: 'start' }
    : null,
  start: () => ({}),
  update: context => context.state,
  buildViewNode: context => context.start === undefined ? null : ({
    key: context.key,
    kind: 'shadow-mind-relay-marker',
    id: context.id,
    target: 'chat',
    anchorSeq: context.start.event.seq,
    location: context.start.location,
    visibility: 'visible',
    data: {},
  }),
}
