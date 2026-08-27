/**
 * Model-catalog projection for the Shadow Mind administration page: every DSH
 * provider/model route with its adapter-advertised reasoning efforts, plus the
 * DSH agent presets a Shadow child may bind to. Providers resolve lazily
 * through the cordis service registry so the plugin still mounts in
 * compositions without an LLM runtime or agent presets.
 * @module @whutzefengxie-ops/dsh-shadow-mind/model-catalog
 */
import type { Context } from '@deepseek-ai/cordis';
/** One adapter-owned reasoning effort displayed for an exact model route. */
export interface ShadowModelEffort {
    /** Opaque value submitted back to the owning adapter. */
    readonly id: string;
    /** Adapter-supplied display name. */
    readonly name: string;
    /** Optional adapter-supplied description. */
    readonly description?: string;
}
/** Selectable reasoning metadata for one exact model route. */
export interface ShadowModelReasoning {
    /** Efforts in adapter-preferred display order. */
    readonly efforts: readonly ShadowModelEffort[];
    /** Adapter-configured default; absence preserves the provider default. */
    readonly defaultEffort?: string;
}
/** One model displayed inside its provider group. */
export interface ShadowCatalogModel {
    /** Provider-owned model id. */
    readonly id: string;
    /** Provider-supplied display name. */
    readonly name: string;
    /** Optional provider-supplied description. */
    readonly description?: string;
    /** Exact-route reasoning metadata when the adapter exposes it. */
    readonly reasoning?: ShadowModelReasoning;
}
/** One provider and the models it advertised successfully. */
export interface ShadowModelGroup {
    /** Provider route id used for requests. */
    readonly id: string;
    /** Provider display name. */
    readonly name: string;
    /** Models in provider-preferred order. */
    readonly models: readonly ShadowCatalogModel[];
}
/** A provider whose asynchronous catalog lookup failed. */
export interface ShadowModelFailure {
    /** Provider route id. */
    readonly id: string;
    /** Provider display name. */
    readonly name: string;
    /** Lookup failure diagnostic. */
    readonly message: string;
}
/** One DSH agent preset a Shadow child may adopt. */
export interface ShadowAgentPresetOption {
    /** Preset id resolved by the agent-presets service. */
    readonly id: string;
    /** Display name; falls back to the id when the preset names none. */
    readonly name: string;
}
/** Detached provider/model/reasoning directory served to the Web settings page. */
export interface ShadowModelCatalog {
    /** Successfully loaded provider groups, each with its advertised models. */
    readonly groups: readonly ShadowModelGroup[];
    /** Provider-local failures; successful groups remain usable. */
    readonly failures: readonly ShadowModelFailure[];
    /** DSH-configured agent presets, in service discovery order. */
    readonly agentPresets: readonly ShadowAgentPresetOption[];
}
/**
 * Build the provider/model catalog over every registered LLM route, mirroring
 * the harness apiproxy catalog semantics: a provider whose lookup fails rides
 * `failures` without hiding sound groups, and groups advertising no models are
 * dropped. Agent presets ride alongside; their resolution failure hides them
 * instead of failing the whole catalog.
 * @param ctx Cordis context owning the optional services.
 * @returns Detached directory suitable for Remote serialization.
 */
export declare function buildShadowModelCatalog(ctx: Context): Promise<ShadowModelCatalog>;
