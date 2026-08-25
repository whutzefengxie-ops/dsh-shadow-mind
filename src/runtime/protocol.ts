/** Durable attribution for batched Shadow reports relayed to a root agent. @module @whutzefengxie-ops/dsh-shadow-mind/protocol */

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ShadowVerdict } from './types.ts'

/** Provenance of one report within a batched relay message. */
export interface ShadowReportProvenance {
  /** Shadow definition id. */
  readonly shadowId: string
  /** Runtime-generated Shadow run id. */
  readonly runId: string
  /** Published child session id. */
  readonly childSessionId: SessionId
  /** Inclusive root sequence watermark used for the Shadow prompt. */
  readonly capturedThroughSeq: number
  /** Epistemic classification of the report. */
  readonly verdict?: ShadowVerdict
  /** Optional within-relay priority from zero through one. */
  readonly severity?: number
  /** Durable sequence anchors named by the report. */
  readonly refs?: readonly number[]
  /** Original report run ids replaced by this synthesized conclusion. */
  readonly replacesRunIds?: readonly string[]
}

/** Durable source attached to one batched Shadow relay. */
export interface ShadowReportMessageSource {
  readonly kind: 'shadow-report'
  readonly form: 'relay'
  /** Ordered provenance aligned with report sections in the message content. */
  readonly reports: readonly ShadowReportProvenance[]
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'shadow-report': ShadowReportMessageSource
  }
}
