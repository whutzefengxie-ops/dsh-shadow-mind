/** Pure Shadow scheduling helper for the single-Shadow model. @module @whutzefengxie-ops/dsh-shadow-mind/scheduler */

import type { RandomSource } from './random.ts'

/**
 * Decide whether the single Shadow reviewer runs after one eligible root turn.
 * @param probability Effective activation probability from zero through one.
 * @param random Source of the single scheduling roll.
 * @returns Whether this turn admits the Shadow.
 */
export function shouldRunShadow(probability: number, random: RandomSource): boolean {
  return random() < probability
}
