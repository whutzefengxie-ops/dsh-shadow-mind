import type {
  ChatConversationViewNode,
  ContextMessageNode,
  ConversationNodeContext,
  SessionId,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ShadowReportMessageSource } from '../runtime/protocol.ts'
import type { ShadowReviewCycle, ShadowRunView } from '../runtime/types.ts'

/** One accepted Shadow report displayed in its review card. */
export interface ShadowMindReportEntry {
  readonly shadowId: string
  readonly runId: string
  readonly childSessionId: SessionId
  readonly capturedThroughSeq: number
  readonly name: string
  readonly content: string
  readonly relaySeq: number
}

/** Candidate review row anchored to the root turn that triggered it. */
export interface ShadowMindReviewChatData {
  /** Root turn/end sequence used as the immutable row anchor. */
  readonly capturedThroughSeq: number
  /** Reports recovered from a durable relay, empty before relay. */
  readonly reports: readonly ShadowMindReportEntry[]
}

/** Empty row used only to hide the generic relay Context projection. */
export type ShadowMindRelayMarkerData = Record<string, never>

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** One live or settled Shadow review at its root turn position. */
    'shadow-mind-review': ShadowMindReviewChatData
    /** Presentation-only marker paired with a durable relay. */
    'shadow-mind-relay-marker': ShadowMindRelayMarkerData
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function modelText(content: ContextMessageNode['content']): string | null {
  let result = ''
  for (const block of content) {
    if (block.type !== 'text') return null
    result += block.text
  }
  return result
}

/**
 * Pair one relay's ordered provenance with its runtime-owned Markdown sections.
 * @param content Durable message content relayed to the root agent.
 * @param source Ordered Shadow provenance stored on the message.
 * @param relaySeq Durable relay sequence.
 * @returns Parsed reports, or null when content and provenance do not align.
 */
export function projectShadowReports(
  content: ContextMessageNode['content'],
  source: ShadowReportMessageSource,
  relaySeq: number,
): readonly ShadowMindReportEntry[] | null {
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
  return source.reports.map((report, index) => {
    const marker = markers[index]
    if (marker === undefined) throw new Error('Shadow report marker projection lost ordering')
    const next = markers[index + 1]
    return {
      ...report,
      name: marker.name,
      content: text.slice(marker.bodyStart, next?.markerStart ?? text.length).trim(),
      relaySeq,
    }
  })
}

/** Merge live lifecycle state with durable report content, preferring the relay copy. */
export function projectReviewRuns(
  cycle: ShadowReviewCycle | undefined,
  reports: readonly ShadowMindReportEntry[],
): readonly ShadowRunView[] {
  const durable = new Map(reports.map(report => [report.runId, report]))
  const runs = (cycle?.runs ?? []).map((run) => {
    const report = durable.get(run.runId)
    if (report === undefined) return run
    durable.delete(run.runId)
    return {
      ...run,
      phase: 'report' as const,
      stage: 'relay' as const,
      childSessionId: report.childSessionId,
      content: report.content,
      relayed: true,
    }
  })
  for (const report of durable.values()) {
    runs.push({
      runId: report.runId,
      shadowId: report.shadowId,
      shadowName: report.name,
      capturedThroughSeq: report.capturedThroughSeq,
      phase: 'report',
      stage: 'relay',
      startedAt: '',
      childSessionId: report.childSessionId,
      content: report.content,
      relayed: true,
    })
  }
  return runs
}

/** Materialize one candidate review row at its triggering root turn. */
export function buildShadowReviewChatNode(
  context: ConversationNodeContext<ShadowMindReviewChatData>,
): ChatConversationViewNode | null {
  const anchor = context.start
  if (anchor === undefined) return null
  return {
    key: context.key,
    kind: 'shadow-mind-review',
    id: context.id,
    target: 'chat',
    anchorSeq: anchor.event.seq,
    location: anchor.location,
    visibility: 'visible',
    data: context.state,
  }
}
