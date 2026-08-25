/** Honest reviewer-vendor classification. @module @whutzefengxie-ops/dsh-shadow-mind/vendor */

import type { ShadowIndependence } from './types.ts'

const PROVIDER_VENDORS: Readonly<Record<string, string>> = Object.freeze({
  anthropic: 'anthropic',
  'aws-bedrock': 'amazon',
  bedrock: 'amazon',
  codex: 'openai',
  deepseek: 'deepseek',
  'deepseek-official': 'deepseek',
  google: 'google',
  'google-vertex': 'google',
  openai: 'openai',
  'openai-compatible': 'unknown',
  vertex: 'google',
})

const MODEL_MARKERS = Object.freeze([
  ['claude', 'anthropic'],
  ['deepseek', 'deepseek'],
  ['gemini', 'google'],
  ['gpt-', 'openai'],
  ['o1', 'openai'],
  ['o3', 'openai'],
] as const)

/**
 * Resolve a provider/model route to a positively known vendor family.
 * @param route Provider/model route.
 * @returns Known vendor or `unknown`; an unknown provider never proves independence.
 */
export function vendorFamily(route: string): string {
  const slash = route.indexOf('/')
  const provider = (slash < 0 ? route : route.slice(0, slash)).toLowerCase()
  const configured = PROVIDER_VENDORS[provider]
  if (configured !== undefined && configured !== 'unknown') return configured
  const model = (slash < 0 ? '' : route.slice(slash + 1)).toLowerCase()
  return MODEL_MARKERS.find(([marker]) => model.includes(marker))?.[1] ?? 'unknown'
}

/**
 * Classify whether two resolved routes provide positive reviewer independence.
 * @param rootRoute Root provider/model route when complete.
 * @param shadowRoute Reviewer provider/model route when complete.
 * @returns Honest independence label.
 */
export function resolveIndependence(
  rootRoute: string | undefined,
  shadowRoute: string | undefined,
): ShadowIndependence {
  if (rootRoute === undefined || shadowRoute === undefined) return 'unavailable'
  const rootVendor = vendorFamily(rootRoute)
  const shadowVendor = vendorFamily(shadowRoute)
  if (rootVendor === 'unknown' || shadowVendor === 'unknown') return 'unverified'
  return rootVendor === shadowVendor ? 'same_vendor' : 'independent'
}

/**
 * Prefer candidates that are not positively known to share the root vendor.
 * @param candidates Already eligible candidates in scheduling order.
 * @param rootRoute Complete root provider/model route when available.
 * @param routeFor Resolved route lookup for each candidate.
 * @returns Filtered candidates only when at least two jury members remain.
 */
export function preferIndependentCandidates<T>(
  candidates: readonly T[],
  rootRoute: string | undefined,
  routeFor: (candidate: T) => string | undefined,
): readonly T[] {
  const preferred = candidates.filter(candidate =>
    resolveIndependence(rootRoute, routeFor(candidate)) !== 'same_vendor')
  return preferred.length >= 2 ? preferred : candidates
}
