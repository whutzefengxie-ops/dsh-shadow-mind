import type {
  ContextMessageNode, ConversationNodeDefinition, SessionId, TurnLocation,
} from '@deepseek-ai/dsh-client-runtime/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ShadowReportMessageSource } from '../runtime/protocol.ts'

/** One accepted Shadow report projected into the closing root Turn. */
export interface ShadowMindReportEntry {
  readonly shadowId: string
  readonly runId: string
  readonly childSessionId: SessionId
  readonly capturedThroughSeq: number
  readonly name: string
  readonly content: string
}

/** Shadow relay facts attached to the Step that admitted the report. */
export interface ShadowMindReportStepData {
  /** Durable root message sequence. */
  readonly reportSeq: number
  /** Accepted reports with durable provenance and display text. */
  readonly reports: readonly ShadowMindReportEntry[]
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationStepDataMap {
    /** Shadow relay admitted before the Step's root Assistant response. */
    'shadow-mind-report': ShadowMindReportStepData
  }
}

/** Target-free report projection; the generic context node remains the only Chat row. */
export const shadowReportStepDefinition: ConversationNodeDefinition<ShadowMindReportStepData> = {
  kind: 'shadow-mind-report',
  match: event => event.type === 'user/message'
    && isAppendSurfaceEvent(event)
    && event.data.source.kind === 'shadow-report'
    ? { id: String(event.data.id), role: 'start' }
    : null,
  start: (_context, match) => {
    if (match.event.type !== 'user/message' || match.event.data.source.kind !== 'shadow-report') {
      throw new Error('shadow-mind-report start requires a shadow-report user/message')
    }
    const reports = parseReportBatch(match.event.data.content, match.event.data.source)
    return { reportSeq: match.event.seq, reports: reports ?? [] }
  },
  update: context => context.state,
  buildLocationData: (context, scope) => {
    const location = context.start?.location
    if (scope !== 'step' || context.state === undefined || location?.kind !== 'step') return null
    return {
      kind: 'step',
      turn: location.turn.turn,
      step: location.step.step,
      key: 'shadow-mind-report',
      value: context.state,
    }
  },
}

/** Combine every Shadow relay admitted in one closing Turn. */
function turnReports(turn: TurnLocation): ShadowMindReportStepData | null {
  let reportSeq = -1
  const reports: ShadowMindReportEntry[] = []
  for (const step of turn.steps) {
    const report = step.data.get('shadow-mind-report')
    if (report === undefined || report.reports.length === 0) continue
    reportSeq = Math.max(reportSeq, report.reportSeq)
    reports.push(...report.reports)
  }
  return reportSeq === -1 ? null : { reportSeq, reports }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function modelText(content: ContextMessageNode['content']): string | null {
  if (content.some(block => block.type !== 'text')) return null
  return content.map(block => block.type === 'text' ? block.text : '').join('')
}

/** Pair one relay's ordered provenance with its runtime-owned Markdown sections. */
function parseReportBatch(
  content: ContextMessageNode['content'],
  source: ShadowReportMessageSource,
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
    }
  })
}

/**
 * Claim the closing reply marker only for a Turn that admitted a Shadow relay.
 * @param owner - Completed Turn and closing Assistant anchor.
 * @returns Combined relay facts, or null when the Turn consumed no Shadow report.
 */
export function selectShadowTriggered(owner: TurnTailOwnerProps): ShadowMindReportStepData | null {
  return turnReports(owner.turn)
}
