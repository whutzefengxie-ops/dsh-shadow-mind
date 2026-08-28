/** Ordered fixed-window report batching with an explicit quiescence barrier. @module @whutzefengxie-ops/dsh-shadow-mind/report-batcher */

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { ShadowVerdict } from './types.ts'

/** One accepted Shadow report awaiting root delivery. */
export interface AcceptedShadowReport {
  /** Root cancellation epoch at acceptance time. */
  readonly epoch: number
  /** Shadow definition id. */
  readonly shadowId: string
  /** Shadow display name. */
  readonly shadowName: string
  /** Runtime-generated run id. */
  readonly runId: string
  /** Published child session id. */
  readonly childSessionId: SessionId
  /** Root event sequence captured by this run. */
  readonly capturedThroughSeq: number
  /** Self-contained report text. */
  readonly content: string
  /** Epistemic classification required for reports. */
  readonly verdict: ShadowVerdict
  /** Optional within-relay priority from zero through one. */
  readonly severity?: number
  /** Ordered durable sequence anchors visible in the run projection. */
  readonly refs: readonly number[]
  /** Owner-only literals retained only until the relay assertion. */
  readonly holdoutKeys?: readonly string[]
}

/** Collect accepted reports for one root agent and deliver fixed-window batches. */
export class ReportBatcher {
  private reports: AcceptedShadowReport[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending = new Set<Promise<void>>()
  private failures: unknown[] = []
  private scheduled: { promise: Promise<void>; settle: () => void } | undefined
  private stopped = false

  /**
   * @param windowMs Current batching window in milliseconds.
   * @param deliver Ordered batch destination.
   */
  constructor(
    private readonly windowMs: () => number,
    private readonly deliver: (reports: readonly AcceptedShadowReport[]) => Promise<void> | void,
  ) {}

  /** Whether a timer or delivery admitted by this batcher is unsettled. */
  get busy(): boolean {
    return this.timer !== undefined || this.pending.size > 0
  }

  /**
   * Add one accepted report in acceptance order.
   * @param report Accepted report to buffer.
   */
  add(report: AcceptedShadowReport): boolean {
    if (this.stopped) return false
    this.reports.push(report)
    if (this.timer !== undefined) return true
    let settle!: () => void
    const pending = new Promise<void>((resolve) => { settle = resolve })
    this.pending.add(pending)
    this.scheduled = { promise: pending, settle }
    this.timer = setTimeout(() => {
      void this.fire()
    }, this.windowMs())
    return true
  }

  /** Resolve after every admitted batch delivery settles. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending])
    if (this.failures.length > 0) {
      const failures = this.failures
      this.failures = []
      throw new AggregateError(failures, 'Shadow report delivery failed')
    }
  }

  /** Deliver the current timer-backed batch immediately without stopping later admission. */
  async flush(): Promise<void> {
    if (this.timer === undefined) {
      await this.drain()
      return
    }
    clearTimeout(this.timer)
    await this.fire()
    await this.drain()
  }

  /** Stop admission, deliver a buffered batch immediately, and reach quiescence. */
  async dispose(): Promise<void> {
    this.stopped = true
    await this.flush()
    await this.drain()
  }

  /** Settle the currently scheduled batch exactly once. */
  private async fire(): Promise<void> {
    const scheduled = this.scheduled
    /* v8 ignore if -- add() is the only fire() caller and installs settlement before scheduling it. */
    if (scheduled === undefined) throw new Error('Shadow report batch fired without an admitted settlement')
    this.scheduled = undefined
    this.timer = undefined
    const batch = this.reports
    this.reports = []
    try {
      await this.deliver(Object.freeze(batch))
    } catch (error: unknown) {
      this.failures.push(error)
    } finally {
      this.pending.delete(scheduled.promise)
      scheduled.settle()
    }
  }
}
