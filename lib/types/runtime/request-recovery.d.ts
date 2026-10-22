/** Bounded request recovery for malformed DeepSeek tool JSON in one Shadow child. */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionSeq } from '@deepseek-ai/dsh-session';
/** Metadata only: the failed attempt already retains the original response. */
export interface ShadowRequestRetry {
    readonly turn: number;
    readonly step: number;
    readonly attemptSeq: SessionSeq;
    readonly code: 'MALFORMED_RESPONSE';
    readonly retry: 1;
}
declare module '@deepseek-ai/dsh-session/types' {
    interface PluginRecordMap {
        'plugin:shadow-mind/request-retry': ShadowRequestRetry;
    }
}
/**
 * Retry at most one request per review, after existing provider recovery declines.
 * The adapter rejects the attempt before any of its tool calls can execute. Use
 * the loop's recovery seam so earlier steps remain committed and the failed
 * assistant/attempt never becomes model-visible history. Never repair arguments.
 */
export declare function attachMalformedToolRecovery(childCtx: Context): void;
