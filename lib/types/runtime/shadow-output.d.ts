/**
 * Shared structured-output contract narrowing for Shadow children.
 *
 * The provider-side JSON Schema cannot express cross-field rules (strictly
 * ascending rendered anchors, verdict required on reports, severity range,
 * report-only fields). The child-side `structured_output` tool enforces this
 * narrowing BEFORE capture so a violation surfaces as INVALID_ARGS and the
 * model retries within the same turn; the runtime applies the same narrowing
 * after completion as a defense-in-depth backstop.
 * @module @whutzefengxie-ops/dsh-shadow-mind/shadow-output
 */
import type { ShadowVerdict } from './types.ts';
/** Narrowed contract accepted by both the child tool and the runtime backstop. */
export type ShadowOutput = {
    readonly status: 'not_relevant' | 'silent';
    readonly content: '';
    readonly refs: readonly [];
} | {
    readonly status: 'report';
    readonly content: string;
    readonly verdict: ShadowVerdict;
    readonly severity?: number;
    readonly refs: readonly number[];
};
/** One narrowing outcome: the accepted value, or path-qualified violations. */
export type NarrowedShadowOutput = {
    readonly value: ShadowOutput;
} | {
    readonly violations: readonly string[];
};
/**
 * Apply the cross-field Shadow output contract to one structured value.
 * Every violation is collected so one retry shows the model everything to fix.
 * @param value - the structured value to narrow.
 * @param projectedSeqs - rendered trajectory anchor seqs; `undefined` skips
 *   the rendered-window membership rule for callers without a projection.
 * @returns the accepted narrowed value or the complete violation list.
 */
export declare function narrowShadowOutput(value: unknown, projectedSeqs?: ReadonlySet<number>): NarrowedShadowOutput;
