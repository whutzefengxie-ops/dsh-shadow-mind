/** Bounded request recovery for malformed DeepSeek tool JSON in one Shadow child. */
import type { Context } from '@deepseek-ai/cordis'
import { appendPluginRecord } from '@deepseek-ai/dsh-session'
import type { SessionSeq } from '@deepseek-ai/dsh-session'

/** Metadata only: the failed attempt already retains the original response. */
export interface ShadowRequestRetry {
  readonly turn: number
  readonly step: number
  readonly attemptSeq: SessionSeq
  readonly code: 'MALFORMED_RESPONSE'
  readonly retry: 1
}

declare module '@deepseek-ai/dsh-session/types' {
  interface PluginRecordMap {
    'plugin:shadow-mind/request-retry': ShadowRequestRetry
  }
}

/**
 * Retry at most one request per review, after existing provider recovery declines.
 * The adapter rejects the attempt before any of its tool calls can execute. Use
 * the loop's recovery seam so earlier steps remain committed and the failed
 * assistant/attempt never becomes model-visible history. Never repair arguments.
 */
export function attachMalformedToolRecovery(childCtx: Context): void {
  let used = false
  childCtx.on('agent/request-error', async ({ agent, turn, step, failure, signal }, next) => {
    const downstream = await next()
    if (downstream?.kind === 'retry' || used || signal.aborted
      || failure.code !== 'MALFORMED_RESPONSE'
      || failure.message !== 'DeepSeek Messages stream: tool input is invalid JSON') return downstream
    const events = agent.session.snapshotEvents()
    const attempt = events.findLast(event => event.type === 'assistant/attempt')
    if (attempt?.type !== 'assistant/attempt' || attempt.data.turn !== turn || attempt.data.step !== step) return downstream
    // Defensive boundary: this step must not already have dispatched any tool.
    if (events.some(event => event.type === 'tool/call' && event.data.turn === turn && event.data.step === step)) return downstream
    const invalidTool = attempt.data.stream.some(record => {
      if (record.type !== 'chunk' || record.chunk.type !== 'block-end' || record.chunk.block.type !== 'tool-call') return false
      try { JSON.parse(record.chunk.block.arguments); return false } catch { return true }
    })
    if (!invalidTool) return downstream
    used = true
    appendPluginRecord(agent.session, 'plugin:shadow-mind/request-retry', {
      turn, step, attemptSeq: attempt.seq, code: 'MALFORMED_RESPONSE', retry: 1,
    })
    return { kind: 'retry' }
  })
}
