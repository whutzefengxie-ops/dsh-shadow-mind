/** Owner-side literal redaction for holdout definitions. @module @whutzefengxie-ops/dsh-shadow-mind/holdout */
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
