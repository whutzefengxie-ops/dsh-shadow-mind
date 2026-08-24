/** Deterministic random source used by Shadow scheduling tests and deployments. @module @whutzefengxie-ops/dsh-shadow-mind/random */
/** A random source returning values in `[0, 1)`. */
export type RandomSource = () => number;
/**
 * Create a deterministic Mulberry32 random source.
 * @param seed Initial 32-bit seed; other finite numbers are truncated.
 * @returns Stateful random source.
 */
export declare function seededRandom(seed: number): RandomSource;
