/** Ordered fixed-window report batching with an explicit quiescence barrier. @module @whutzefengxie-ops/dsh-shadow-mind/report-batcher */
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { ShadowVerdict } from './types.ts';
/** One accepted Shadow report awaiting root delivery. */
export interface AcceptedShadowReport {
    /** Root cancellation epoch at acceptance time. */
    readonly epoch: number;
    /** Shadow definition id. */
    readonly shadowId: string;
    /** Shadow display name. */
    readonly shadowName: string;
    /** Runtime-generated run id. */
    readonly runId: string;
    /** Published child session id. */
    readonly childSessionId: SessionId;
    /** Root event sequence captured by this run. */
    readonly capturedThroughSeq: number;
    /** Self-contained report text. */
    readonly content: string;
    /** Epistemic classification required for reports. */
    readonly verdict: ShadowVerdict;
    /** Optional within-relay priority from zero through one. */
    readonly severity?: number;
    /** Ordered durable sequence anchors visible in the run projection. */
    readonly refs: readonly number[];
    /** Owner-only literals retained only until the relay assertion. */
    readonly holdoutKeys?: readonly string[];
}
/** Collect accepted reports for one root agent and deliver fixed-window batches. */
export declare class ReportBatcher {
    private readonly windowMs;
    private readonly deliver;
    private reports;
    private timer;
    private pending;
    private failures;
    private scheduled;
    private stopped;
    /**
     * @param windowMs Current batching window in milliseconds.
     * @param deliver Ordered batch destination.
     */
    constructor(windowMs: () => number, deliver: (reports: readonly AcceptedShadowReport[]) => Promise<void> | void);
    /** Whether a timer or delivery admitted by this batcher is unsettled. */
    get busy(): boolean;
    /**
     * Add one accepted report in acceptance order.
     * @param report Accepted report to buffer.
     */
    add(report: AcceptedShadowReport): boolean;
    /** Resolve after every admitted batch delivery settles. */
    drain(): Promise<void>;
    /** Deliver the current timer-backed batch immediately without stopping later admission. */
    flush(): Promise<void>;
    /** Stop admission, deliver a buffered batch immediately, and reach quiescence. */
    dispose(): Promise<void>;
    /** Settle the currently scheduled batch exactly once. */
    private fire;
}
