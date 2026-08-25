/** Honest reviewer-vendor classification. @module @whutzefengxie-ops/dsh-shadow-mind/vendor */
import type { ShadowIndependence } from './types.ts';
/**
 * Resolve a provider/model route to a positively known vendor family.
 * @param route Provider/model route.
 * @returns Known vendor or `unknown`; an unknown provider never proves independence.
 */
export declare function vendorFamily(route: string): string;
/**
 * Classify whether two resolved routes provide positive reviewer independence.
 * @param rootRoute Root provider/model route when complete.
 * @param shadowRoute Reviewer provider/model route when complete.
 * @returns Honest independence label.
 */
export declare function resolveIndependence(rootRoute: string | undefined, shadowRoute: string | undefined): ShadowIndependence;
/**
 * Prefer candidates that are not positively known to share the root vendor.
 * @param candidates Already eligible candidates in scheduling order.
 * @param rootRoute Complete root provider/model route when available.
 * @param routeFor Resolved route lookup for each candidate.
 * @returns Filtered candidates only when at least two jury members remain.
 */
export declare function preferIndependentCandidates<T>(candidates: readonly T[], rootRoute: string | undefined, routeFor: (candidate: T) => string | undefined): readonly T[];
