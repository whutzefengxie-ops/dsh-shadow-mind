/** Pure Shadow eligibility and probabilistic scheduling helpers. @module @whutzefengxie-ops/dsh-shadow-mind/scheduler */
import type { ShadowDefinition } from './types.ts';
import type { RandomSource } from './random.ts';
/**
 * Whether a definition accepts the root agent's provider/model route.
 * @param definition Candidate definition.
 * @param provider Root provider, when configured.
 * @param model Root model, when configured.
 * @returns Eligibility under `active_for_models`.
 */
export declare function modelEligible(definition: ShadowDefinition, provider: string | undefined, model: string | undefined): boolean;
/**
 * Select definitions after heartbeat, model, per-definition, duplicate, and slot gates.
 * @param definitions Catalog definitions in deterministic source order.
 * @param options Scheduling inputs.
 * @returns Selected definitions in catalog order unless capacity requires an unbiased shuffled subset.
 */
export declare function selectShadows(definitions: readonly ShadowDefinition[], options: {
    readonly heartbeatProbability: number;
    readonly availableSlots: number;
    readonly activeIds: ReadonlySet<string>;
    readonly provider?: string;
    readonly model?: string;
    readonly random: RandomSource;
    readonly probabilityFor?: (definition: ShadowDefinition) => number;
}): ShadowDefinition[];
