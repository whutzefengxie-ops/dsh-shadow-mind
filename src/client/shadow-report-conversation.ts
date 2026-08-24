import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'
import {
  buildShadowReportChatNode,
  projectShadowReport,
  type ShadowMindReportChatData,
} from './shadow-report-projection.ts'

/** Project each accepted Shadow report batch into its own durable Chat row. */
export const shadowReportDefinition: ConversationNodeDefinition<ShadowMindReportChatData | null> = {
  kind: 'shadow-mind-report',
  target: 'chat',
  match: event => event.type === 'user/message'
    && isAppendSurfaceEvent(event)
    && event.data.source.kind === 'shadow-report'
    ? { id: String(event.data.id), role: 'start' }
    : null,
  start: (_context, match) => {
    if (match.event.type !== 'user/message' || match.event.data.source.kind !== 'shadow-report') {
      throw new Error('shadow-mind-report start requires a shadow-report user/message')
    }
    return projectShadowReport(match.event.data.content, match.event.data.source, match.event.seq)
  },
  update: context => context.state,
  buildViewNode: buildShadowReportChatNode,
}
