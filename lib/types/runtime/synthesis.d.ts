/**
 * Conflict selection, literal redaction, and prompt construction for Shadow synthesis.
 * @module @whutzefengxie-ops/dsh-shadow-mind/synthesis
 */
import type { AcceptedShadowReport } from './report-batcher.ts';
import type { ShadowDefinition } from './types.ts';
/** One challenge/confirm pair selected for at most one synthesis run. */
export interface ShadowConflict {
    readonly left: AcceptedShadowReport;
    readonly right: AcceptedShadowReport;
}
/**
 * Select the closest-severity conflict, using higher combined severity as the stable tie-break.
 * @param reports One accepted delivery batch.
 * @returns One conflict or undefined; no batch can request more than one synthesizer.
 */
export declare function selectShadowConflict(reports: readonly AcceptedShadowReport[]): ShadowConflict | undefined;
/**
 * Replace every owner-side literal without regex interpretation.
 * @param text Model-visible text.
 * @param keys Owner-side literal keys.
 * @returns Text with every literal occurrence replaced.
 */
export declare function redactHoldoutLiterals(text: string, keys: readonly string[]): string;
/**
 * Test whether any owner-side literal survived a model-visible value.
 * @param text Model-visible text.
 * @param keys Owner-side literal keys.
 * @returns Whether at least one literal remains.
 */
export declare function containsHoldoutLiteral(text: string, keys: readonly string[]): boolean;
/**
 * Build one bounded synthesis prompt from already-redacted report text.
 * @param definition Synthesizer definition.
 * @param conflict Selected report pair.
 * @param maxChars Complete prompt limit.
 * @returns Complete model-visible prompt.
 */
export declare function buildSynthesisPrompt(definition: ShadowDefinition, conflict: ShadowConflict, maxChars: number): string;
