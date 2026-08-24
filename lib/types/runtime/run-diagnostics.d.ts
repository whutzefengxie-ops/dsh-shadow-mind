/** Stable Shadow lifecycle diagnostics that never expose model inputs. */
import type { ShadowCancellationSource, ShadowRunReasonCode, ShadowRunStage, ShadowSafeError } from './types.ts';
/** Cancellation metadata retained before an AbortSignal is fired. */
export interface ShadowCancellation {
    readonly reasonCode: ShadowRunReasonCode;
    readonly source: ShadowCancellationSource;
}
/** Failure captured at one owned lifecycle stage. */
export interface ShadowFailure {
    readonly stage: ShadowRunStage;
    readonly reasonCode: ShadowRunReasonCode;
    readonly error: ShadowSafeError;
}
/** Remove common credential and absolute-path forms from one diagnostic string. */
export declare function sanitizeDiagnosticMessage(input: string): string;
/** Convert an unknown thrown value into a bounded Remote- and JSON-safe summary. */
export declare function safeError(error: unknown): ShadowSafeError;
/** Classify a thrown failure by the stage that owned the operation. */
export declare function failureAt(stage: ShadowRunStage, error: unknown): ShadowFailure;
