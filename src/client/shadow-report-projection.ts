import type {
  ChatConversationViewNode,
  ContextMessageNode,
  ConversationNodeContext,
  SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ShadowReportMessageSource } from '../runtime/protocol.ts'

/** One accepted Shadow report displayed at its relay position. */
export interface ShadowMindReportEntry {
  readonly shadowId: string
  readonly runId: string
  readonly childSessionId: SessionId
  readonly capturedThroughSeq: number
  readonly name: string
  readonly content: string
}

/** Durable Shadow relay rendered as one dedicated Chat row. */
export interface ShadowMindReportChatData {
  /** Durable root message sequence used as the row anchor. */
  readonly reportSeq: number
  /** Accepted reports with durable provenance and display text. */
  readonly reports: readonly ShadowMindReportEntry[]
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** One batch of accepted Shadow reports at its root relay position. */
    'shadow-mind-report': ShadowMindReportChatData
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function modelText(content: ContextMessageNode['content']): string | null {
  if (content.some(block => block.type !== 'text')) return null
  return content.map(block => block.type === 'text' ? block.text : '').join('')
}

/**
 * Pair one relay's ordered provenance with its runtime-owned Markdown sections.
 * @param content - Durable message content relayed to the root agent.
 * @param source - Ordered Shadow provenance stored on the message.
 * @param reportSeq - Durable message sequence used for Chat ordering.
 * @returns Display data, or null when content and provenance do not align.
 */
export function projectShadowReport(
  content: ContextMessageNode['content'],
  source: ShadowReportMessageSource,
  reportSeq: number,
): ShadowMindReportChatData | null {
  const text = modelText(content)
  if (text === null || source.reports.length === 0) return null
  const markers: Array<{ name: string; bodyStart: number; markerStart: number }> = []
  let cursor = 0
  for (const report of source.reports) {
    const pattern = new RegExp(`\\n### ([^\\r\\n]+) \\(${escapeRegExp(report.shadowId)}\\)\\r?\\n`, 'gu')
    pattern.lastIndex = cursor
    const match = pattern.exec(text)
    if (match === null || match[1] === undefined) return null
    markers.push({ name: match[1].trim(), markerStart: match.index, bodyStart: pattern.lastIndex })
    cursor = pattern.lastIndex
  }
  const reports = source.reports.map((report, index) => {
    const marker = markers[index]
    if (marker === undefined) throw new Error('Shadow report marker projection lost ordering')
    const next = markers[index + 1]
    return {
      ...report,
      name: marker.name,
      content: text.slice(marker.bodyStart, next?.markerStart ?? text.length).trim(),
    }
  })
  return { reportSeq, reports }
}

/**
 * Materialize one Shadow report row at the durable relay event.
 * @param context - Definition context containing parsed report data.
 * @returns Visible Chat node, or null when the relay was malformed.
 */
export function buildShadowReportChatNode(
  context: ConversationNodeContext<ShadowMindReportChatData | null>,
): ChatConversationViewNode | null {
  const anchor = context.start
  const data = context.state
  if (anchor === undefined || data === undefined || data === null || data.reports.length === 0) return null
  return {
    key: context.key,
    kind: 'shadow-mind-report',
    id: context.id,
    target: 'chat',
    anchorSeq: anchor.event.seq,
    location: anchor.location,
    visibility: 'visible',
    data,
  }
}
