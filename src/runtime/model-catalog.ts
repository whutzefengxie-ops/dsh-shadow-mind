/**
 * Model-catalog projection for the Shadow Mind administration page: every DSH
 * provider/model route with its adapter-advertised reasoning efforts, plus the
 * DSH agent presets a Shadow child may bind to. Providers resolve lazily
 * through the cordis service registry so the plugin still mounts in
 * compositions without an LLM runtime or agent presets.
 * @module @whutzefengxie-ops/dsh-shadow-mind/model-catalog
 */

import type { Context } from '@deepseek-ai/cordis'
import type { LlmResolvedModelInfo, ReasoningEffortId } from '@deepseek-ai/dsh-llm'

/** One adapter-owned reasoning effort displayed for an exact model route. */
export interface ShadowModelEffort {
  /** Opaque value submitted back to the owning adapter. */
  readonly id: string
  /** Adapter-supplied display name. */
  readonly name: string
  /** Optional adapter-supplied description. */
  readonly description?: string
}

/** Selectable reasoning metadata for one exact model route. */
export interface ShadowModelReasoning {
  /** Efforts in adapter-preferred display order. */
  readonly efforts: readonly ShadowModelEffort[]
  /** Adapter-configured default; absence preserves the provider default. */
  readonly defaultEffort?: string
}

/** One model displayed inside its provider group. */
export interface ShadowCatalogModel {
  /** Provider-owned model id. */
  readonly id: string
  /** Provider-supplied display name. */
  readonly name: string
  /** Optional provider-supplied description. */
  readonly description?: string
  /** Exact-route reasoning metadata when the adapter exposes it. */
  readonly reasoning?: ShadowModelReasoning
}

/** One provider and the models it advertised successfully. */
export interface ShadowModelGroup {
  /** Provider route id used for requests. */
  readonly id: string
  /** Provider display name. */
  readonly name: string
  /** Models in provider-preferred order. */
  readonly models: readonly ShadowCatalogModel[]
}

/** A provider whose asynchronous catalog lookup failed. */
export interface ShadowModelFailure {
  /** Provider route id. */
  readonly id: string
  /** Provider display name. */
  readonly name: string
  /** Lookup failure diagnostic. */
  readonly message: string
}

/** One DSH agent preset a Shadow child may adopt. */
export interface ShadowAgentPresetOption {
  /** Preset id resolved by the agent-presets service. */
  readonly id: string
  /** Display name; falls back to the id when the preset names none. */
  readonly name: string
}

/** Detached provider/model/reasoning directory served to the Web settings page. */
export interface ShadowModelCatalog {
  /** Successfully loaded provider groups, each with its advertised models. */
  readonly groups: readonly ShadowModelGroup[]
  /** Provider-local failures; successful groups remain usable. */
  readonly failures: readonly ShadowModelFailure[]
  /** DSH-configured agent presets, in service discovery order. */
  readonly agentPresets: readonly ShadowAgentPresetOption[]
}

/** Service surface consumed by the catalog builder. */
interface LlmFace {
  listProviders(): readonly { id: string; name: string }[]
  listModels(provider: string): Promise<readonly { id: string; name: string; description?: string }[]>
  resolveModelInfo(provider: string, model: string): Promise<LlmResolvedModelInfo>
}

/** Service surface consumed by the agent-preset roster. */
interface AgentPresetsFace {
  list(): Promise<readonly { id: string; name?: string }[]>
}

/** Resolve an optional service without importing the package that declares it. */
function optionalService<T>(ctx: Context, name: string): T | undefined {
  return ctx.get(name) as T | undefined
}

/** Resolve one adapter-owned effort id for wire transport. */
function effortId(value: ReasoningEffortId | undefined): string | undefined {
  return value === undefined ? undefined : String(value)
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
export async function buildShadowModelCatalog(ctx: Context): Promise<ShadowModelCatalog> {
  const llm = optionalService<LlmFace>(ctx, 'llm')
  const groups: ShadowModelGroup[] = []
  const failures: ShadowModelFailure[] = []
  if (llm !== undefined) {
    const providers = llm.listProviders()
    for (const provider of providers) {
      try {
        const models = await llm.listModels(provider.id)
        const entries: ShadowCatalogModel[] = []
        for (const model of models) {
          const reasoning = await resolveReasoning(llm, provider.id, model.id)
          entries.push({
            id: model.id,
            name: model.name,
            ...model.description === undefined ? {} : { description: model.description },
            ...reasoning === undefined ? {} : { reasoning },
          })
        }
        if (entries.length > 0) groups.push({ id: provider.id, name: provider.name, models: entries })
      } catch (error: unknown) {
        failures.push({
          id: provider.id,
          name: provider.name,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
  const agentPresets: ShadowAgentPresetOption[] = []
  const presets = optionalService<AgentPresetsFace>(ctx, 'agentPresets')
  if (presets !== undefined) {
    try {
      const listed = await presets.list()
      for (const preset of listed) agentPresets.push({ id: preset.id, name: preset.name ?? preset.id })
    } catch (error: unknown) {
      // Preset discovery is advisory: an unreadable root must not hide the
      // model directory this snapshot also carries.
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ id: '(agent-presets)', name: '(agent-presets)', message })
    }
  }
  return { groups, failures, agentPresets }
}

/** Resolve adapter-advertised reasoning metadata for one exact route. */
async function resolveReasoning(
  llm: LlmFace,
  provider: string,
  model: string,
): Promise<ShadowModelReasoning | undefined> {
  let resolved: LlmResolvedModelInfo
  try {
    resolved = await llm.resolveModelInfo(provider, model)
  } catch {
    // Exact-route metadata is advisory: the group keeps the model while the
    // effort selector falls back to the configured ladder.
    return undefined
  }
  const reasoning = resolved.reasoning
  if (reasoning === undefined) return undefined
  const defaultEffort = effortId(reasoning.defaultEffort)
  return {
    efforts: reasoning.efforts.map(effort => ({
      id: effort.id,
      name: effort.name,
      ...effort.description === undefined ? {} : { description: effort.description },
    })),
    ...defaultEffort === undefined ? {} : { defaultEffort },
  }
}
