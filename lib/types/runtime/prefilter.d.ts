/** Deterministic zero-model-cost Shadow scheduling predicates. @module @whutzefengxie-ops/dsh-shadow-mind/prefilter */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { ShadowDefinition, ShadowMindSettings } from './types.ts';
/** Inputs shared by skip and boost predicates. */
export interface PredicateContext {
    readonly events: readonly SessionEvent[];
    readonly capturedThroughSeq: number;
    readonly definition: ShadowDefinition;
    readonly settings: ShadowMindSettings;
}
/** One pure deterministic scheduling predicate. */
export type ShadowPredicate = (context: PredicateContext) => boolean;
/** Predicates that skip a selected definition before any model call. */
export declare const prefilterPredicates: ReadonlyMap<string, ShadowPredicate>;
/** Predicates that multiply a definition's activation probability. */
export declare const boostPredicates: ReadonlyMap<string, ShadowPredicate>;
/**
 * Evaluate configured predicate names against one captured turn.
 * @param names Predicate ids in evaluation order.
 * @param registry Predicate implementations by id.
 * @param context Captured turn, definition, and resolved settings.
 * @returns First matching predicate id, or undefined when none match.
 */
export declare function matchesPredicate(names: readonly string[], registry: ReadonlyMap<string, ShadowPredicate>, context: PredicateContext): string | undefined;
