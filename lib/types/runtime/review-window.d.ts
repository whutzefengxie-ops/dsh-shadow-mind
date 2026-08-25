/** Pure stagnation detection over accepted anchored Shadow envelopes. @module @whutzefengxie-ops/dsh-shadow-mind/review-window */
import type { ShadowReviewStatus } from './types.ts';
/** One accepted report retained in a root's process-local review window. */
export interface ReviewEntry extends ShadowReviewStatus {
}
/** Tunable thresholds for every stagnation detector. */
export interface ReviewWindowOptions {
    readonly spinningRepeatCount: number;
    readonly oscillationPeriods: number;
    readonly noDriftRepeatCount: number;
    readonly diminishingWindowSize: number;
    readonly diminishingNoveltyThreshold: number;
}
/** Named stagnation pattern detected for the latest report of one definition. */
export interface StagnationDetection {
    readonly shadowId: string;
    readonly pattern: 'spinning' | 'oscillation' | 'no-drift' | 'diminishing';
    readonly runIds: readonly string[];
}
/**
 * Detect every configured pattern ending at each definition's latest entry.
 * @param entries Accepted entries in completion order.
 * @param options Detector thresholds.
 * @returns Stable definition and pattern order.
 */
export declare function detectPatterns(entries: readonly ReviewEntry[], options: ReviewWindowOptions): StagnationDetection[];
