/** Deterministic random source used by Shadow scheduling tests and deployments. @module @whutzefengxie-ops/dsh-shadow-mind/random */

/** A random source returning values in `[0, 1)`. */
export type RandomSource = () => number

/**
 * Create a deterministic Mulberry32 random source.
 * @param seed Initial 32-bit seed; other finite numbers are truncated.
 * @returns Stateful random source.
 */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}
