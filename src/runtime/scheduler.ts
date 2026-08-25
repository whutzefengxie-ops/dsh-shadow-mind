/** Pure Shadow eligibility and probabilistic scheduling helpers. @module @whutzefengxie-ops/dsh-shadow-mind/scheduler */

import type { ShadowDefinition } from './types.ts'
import type { RandomSource } from './random.ts'

/** Match `*` and `?` model patterns without treating other characters as regular expressions. */
function matchesGlob(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&').replace(/\*/gu, '.*').replace(/\\\?/gu, '.')
  return new RegExp(`^${escaped}$`, 'u').test(value)
}

/**
 * Whether a definition accepts the root agent's provider/model route.
 * @param definition Candidate definition.
 * @param provider Root provider, when configured.
 * @param model Root model, when configured.
 * @returns Eligibility under `active_for_models`.
 */
export function modelEligible(
  definition: ShadowDefinition,
  provider: string | undefined,
  model: string | undefined,
): boolean {
  if (definition.activeForModels.length === 0) return true
  if (model === undefined) return false
  const qualified = provider === undefined ? model : `${provider}/${model}`
  return definition.activeForModels.some(pattern => matchesGlob(model, pattern) || matchesGlob(qualified, pattern))
}

/**
 * Select definitions after heartbeat, model, per-definition, duplicate, and slot gates.
 * @param definitions Catalog definitions in deterministic source order.
 * @param options Scheduling inputs.
 * @returns Selected definitions in catalog order unless capacity requires an unbiased shuffled subset.
 */
export function selectShadows(
  definitions: readonly ShadowDefinition[],
  options: {
    readonly heartbeatProbability: number
    readonly availableSlots: number
    readonly activeIds: ReadonlySet<string>
    readonly provider?: string
    readonly model?: string
    readonly random: RandomSource
    readonly probabilityFor?: (definition: ShadowDefinition) => number
  },
): ShadowDefinition[] {
  const heartbeatRoll = options.random()
  if (heartbeatRoll >= options.heartbeatProbability || options.availableSlots <= 0) return []
  const hits: ShadowDefinition[] = []
  for (const definition of definitions) {
    if (!definition.enabled || options.activeIds.has(definition.id)) continue
    if (!modelEligible(definition, options.provider, options.model)) continue
    if (options.random() < (options.probabilityFor?.(definition) ?? definition.activationProbability)) {
      hits.push(definition)
    }
  }
  if (hits.length > options.availableSlots) {
    for (let index = hits.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(options.random() * (index + 1))
      const held = hits[index]
      const replacement = hits[swap]
      /* v8 ignore if -- both indices are derived from the current non-empty array bounds. */
      if (held === undefined || replacement === undefined) throw new Error('Shadow sampling index escaped its array bounds')
      hits[index] = replacement
      hits[swap] = held
    }
  }
  return hits.slice(0, options.availableSlots)
}
