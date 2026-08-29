/** Shadow management tools and the `/shadow` root-agent command. @module @whutzefengxie-ops/dsh-shadow-mind/tool */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-user-approval'
import type {
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindStatus,
  UpdateShadowMindSettings,
} from '../runtime/index.ts'
import { DEFAULT_SHADOW_ID } from '../runtime/index.ts'

/** Cordis plugin name. */
export const name = 'tool-shadow-mind'
/** Required runtime, tool, command, and approval services. */
export const inject = ['tools', 'shadowMind', 'commands', 'approval']

/** Shared canonical text result declaration. */
function textOutput() {
  return {
    schema: {
      type: 'object' as const,
      additionalProperties: false as const,
      properties: { result: { type: 'string' as const, required: true as const } },
    },
    render: (_args: unknown, value: { result: string }) => [{
      type: 'text' as const,
      text: value.result,
    }],
  }
}

/** Request explicit approval for one definition or settings mutation. */
async function approve(ctx: Context, exec: ToolRunContext, reason: string): Promise<void> {
  if (exec.agent === undefined) throw new Error(`${exec.name} requires a calling agent`)
  const outcome = await ctx.approval.request({
    agent: exec.agent,
    toolName: exec.name,
    callId: exec.callId,
    reason,
    signal: exec.signal,
  })
  if (outcome !== 'allowed-once') throw new Error(`Shadow Mind mutation was not approved (${outcome})`)
}

/** JSON-safe definition view returned to the model. */
function definitionView(definition: ShadowDefinition): Record<string, unknown> {
  return {
    id: definition.id,
    name: definition.name,
    enabled: definition.enabled,
    debug: definition.debug,
    activation_probability: definition.activationProbability,
    active_for_models: definition.activeForModels,
    run_with_model: definition.runWithModel ?? null,
    reasoning_effort: definition.reasoningEffort ?? null,
    timeout_seconds: definition.timeoutSeconds ?? null,
    tools: definition.tools,
    capture: definition.capture,
    context: definition.context,
    think_first: definition.thinkFirst,
    holdout: definition.holdout,
    prompt: definition.prompt,
  }
}

/** Stable pretty JSON for management-tool output. */
function result(value: unknown): { result: string } {
  return { result: JSON.stringify(value, null, 2) }
}

/** Convert one parsed update_default_shadow argument record into a merged default-definition input. */
function mergedDefault(args: Record<string, unknown>, current: ShadowDefinition): ShadowDefinitionInput {
  return {
    id: DEFAULT_SHADOW_ID,
    name: args.name === undefined ? current.name : args.name as string,
    enabled: args.enabled === undefined ? current.enabled : args.enabled as boolean,
    debug: args.debug === undefined ? current.debug : args.debug as boolean,
    activationProbability: args.activation_probability === undefined
      ? current.activationProbability
      : args.activation_probability as number,
    activeForModels: args.active_for_models === undefined ? current.activeForModels : args.active_for_models as string[],
    runWithModel: args.run_with_model === undefined
      ? current.runWithModel ?? null
      : args.run_with_model as string | null,
    reasoningEffort: args.reasoning_effort === undefined
      ? current.reasoningEffort ?? null
      : args.reasoning_effort as string | null,
    timeoutSeconds: args.timeout_seconds === undefined
      ? current.timeoutSeconds ?? null
      : args.timeout_seconds as number | null,
    tools: args.tools === undefined ? current.tools : args.tools as string[],
    capture: args.capture === undefined ? current.capture : args.capture as ShadowDefinition['capture'],
    context: args.context === undefined ? current.context : args.context as ShadowDefinition['context'],
    thinkFirst: args.think_first === undefined ? current.thinkFirst : args.think_first as boolean,
    holdout: current.holdout,
    prompt: args.prompt === undefined ? current.prompt : args.prompt as string,
  }
}

/** Editable fields of the single default Shadow definition. */
const DEFAULT_SHADOW_PARAMETERS = {
  name: { type: 'string' as const, description: 'Human-readable Shadow name.' },
  enabled: { type: 'boolean' as const, description: 'Whether automatic scheduling may select the Shadow.' },
  debug: { type: 'boolean' as const, description: 'Whether run lifecycle transitions append local JSONL diagnostics.' },
  activation_probability: { type: 'number' as const, description: 'Per-turn review probability from 0 through 1.' },
  active_for_models: {
    type: 'array' as const,
    description: 'Optional model or provider/model glob filters.',
    items: { type: 'string' as const },
  },
  run_with_model: {
    oneOf: [{ type: 'string' as const }, { type: 'null' as const }] as const,
    description: 'Optional provider/model route; null clears the override and inherits the root agent model.',
  },
  reasoning_effort: {
    oneOf: [{ type: 'string' as const }, { type: 'null' as const }] as const,
    description: 'Optional adapter-owned reasoning effort; null clears the override.',
  },
  timeout_seconds: {
    oneOf: [{ type: 'number' as const }, { type: 'null' as const }] as const,
    description: 'Optional positive run deadline; null clears the override.',
  },
  tools: {
    type: 'array' as const,
    description: 'Extra tools added to read, grep, and glob.',
    items: { type: 'string' as const },
  },
  capture: {
    type: 'string' as const,
    enum: ['full', 'since-compaction'] as const,
    description: 'Root trajectory window captured by the Shadow.',
  },
  context: {
    type: 'string' as const,
    enum: ['standard', 'minimal'] as const,
    description: 'Whether model-visible dynamic runtime context is inherited.',
  },
  think_first: {
    type: 'boolean' as const,
    description: 'Require a tool-free planning request before investigation.',
  },
  prompt: { type: 'string' as const, description: 'Non-empty Shadow instructions.' },
} as const

/** Compact acknowledgment for one admitted manual Shadow run. */
function admittedConfirmation(operation: 'retry' | 'new', status: ShadowMindStatus): string {
  const runs = status.active.map(entry => `${entry.shadowId}/${entry.runId}`)
  return runs.length === 0
    ? `Shadow ${operation} acknowledged; no run is active.`
    : `Shadow ${operation} admitted; ${String(runs.length)} running: ${runs.join(', ')}.`
}

/** Register all Shadow management tools and the human command. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'shadow',
    description: 'Retry the latest failed Shadow review or force a fresh review',
    input: { hint: '[retry|new]', images: false },
    handler: async ({ agent, rawInput }) => {
      const operation = rawInput.trim()
      if (operation !== 'retry' && operation !== 'new') {
        return { kind: 'error', text: 'Usage: /shadow [retry|new]' }
      }
      try {
        const status = operation === 'retry'
          ? await ctx.shadowMind.retryLatest(agent)
          : await ctx.shadowMind.reviewNow(agent)
        return { kind: 'success', text: admittedConfirmation(operation, status) }
      } catch (error: unknown) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      }
    },
  })

  ctx.tools.register(defineTool({
    name: 'list_shadows',
    description: 'List Shadow definitions and isolated file diagnostics. The single scheduled Shadow is `default`; other files are read-only legacy definitions.',
    parameters: {},
    output: textOutput(),
    execute: async () => {
      const catalog = await ctx.shadowMind.listDefinitions()
      return result({
        definitions: catalog.definitions.map(definitionView),
        diagnostics: catalog.diagnostics,
      })
    },
    presentCall: () => ({ card: 'generic', title: 'List Shadow Minds', kind: 'read' }),
  }))

  ctx.tools.register(defineTool({
    name: 'update_default_shadow',
    description: 'Update selected fields of the single default Shadow definition. This changes local configuration and requires user approval.',
    parameters: {
      ...DEFAULT_SHADOW_PARAMETERS,
    },
    output: textOutput(),
    execute: async (args, exec) => {
      const entries = Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== undefined)
      if (entries.length === 0) throw new Error('update_default_shadow requires at least one field to update')
      const catalog = await ctx.shadowMind.listDefinitions()
      const current = catalog.definitions.find(definition => definition.id === DEFAULT_SHADOW_ID)
      if (current === undefined) {
        throw new Error(`the default Shadow (${DEFAULT_SHADOW_ID}) does not exist yet`)
      }
      await approve(ctx, exec, 'Update the default Shadow definition')
      const next = mergedDefault(Object.fromEntries(entries), current)
      return result(definitionView(await ctx.shadowMind.saveDefaultDefinition(next)))
    },
    presentCall: () => ({ card: 'generic', title: 'Update default Shadow', kind: 'execute', rawInput: DEFAULT_SHADOW_ID }),
  }))

  ctx.tools.register(defineTool({
    name: 'get_shadow_config',
    description: 'Read the current resolved Shadow Mind scheduling configuration.',
    parameters: {},
    output: textOutput(),
    execute: () => Promise.resolve(result(ctx.shadowMind.currentSettings())),
    presentCall: () => ({ card: 'generic', title: 'Read Shadow Mind config', kind: 'read' }),
  }))

  ctx.tools.register(defineTool({
    name: 'update_shadow_config',
    description: 'Update selected Shadow Mind scheduling settings. This changes local configuration and requires user approval.',
    parameters: {
      defaultShadowTimeoutSeconds: { type: 'number', description: 'Positive default run deadline.' },
      headlessDrainTimeoutSeconds: { type: 'number', description: 'Positive headless convergence deadline.' },
      resultBatchWindowMs: { type: 'number', description: 'Non-negative report batching window.' },
      argumentDisclosure: { type: 'string', enum: ['redacted', 'full'], description: 'Tool-call argument projection policy.' },
      randomSeed: {
        oneOf: [{ type: 'number' }, { type: 'null' }],
        description: 'Deterministic scheduler seed; null clears the user override.',
      },
      maxPromptChars: { type: 'number', description: 'Complete prompt bound; oversized prompts are trimmed to fit. 0 uses the selected model context window.' },
      maxReportChars: { type: 'number', description: 'Accepted report bound; oversized reports are truncated. 0 disables the limit.' },
      valueLoopEnabled: { type: 'boolean', description: 'Persist metadata-only challenge dispositions.' },
      valueLoopWindowTurns: { type: 'number', description: 'Root turns observed before a challenge becomes ignored.' },
      reviewWindowSize: { type: 'number', description: 'Accepted report entries retained per definition.' },
      spinningRepeatCount: { type: 'number', description: 'Identical-envelope threshold for spinning.' },
      oscillationPeriods: { type: 'number', description: 'Alternating verdict periods required for oscillation.' },
      noDriftRepeatCount: { type: 'number', description: 'Unchanged confirmation threshold for no-drift.' },
      diminishingWindowSize: { type: 'number', description: 'Suffix length for diminishing novelty.' },
      diminishingNoveltyThreshold: { type: 'number', description: 'Minimum novel-envelope share from 0 through 1.' },
      stagnationCooldownSeconds: { type: 'number', description: 'Wall-clock stagnation cooldown.' },
      stagnationEscalationEnabled: { type: 'boolean', description: 'Escalate oscillating reviewers by one reasoning-effort rung.' },
      reasoningEffortLadder: {
        type: 'array',
        description: 'Ordered unique reasoning-effort rung names.',
        items: { type: 'string' },
      },
      sessionShadowSoftBudgetChars: {
        oneOf: [{ type: 'number' }, { type: 'null' }],
        description: 'Character spend that activates the frugal route; null clears the user override.',
      },
      sessionShadowHardBudgetChars: {
        oneOf: [{ type: 'number' }, { type: 'null' }],
        description: 'Character spend that stops new Shadow runs; null clears the user override.',
      },
      frugalShadowModel: {
        oneOf: [{ type: 'string' }, { type: 'null' }],
        description: 'Provider/model route used after the soft budget; null clears the user override.',
      },
      staleReportDecay: { type: 'number', description: 'Repeated-envelope probability decay from 0 through 1.' },
    },
    output: textOutput(),
    execute: async (args, exec) => {
      const entries = Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== undefined)
      const patch = Object.fromEntries(entries) as UpdateShadowMindSettings
      if (Object.keys(patch).length === 0) throw new Error('update_shadow_config requires at least one setting')
      await approve(ctx, exec, 'Update Shadow Mind scheduling configuration')
      await ctx.shadowMind.updateSettings(patch)
      return result(ctx.shadowMind.currentSettings())
    },
    presentCall: () => ({ card: 'generic', title: 'Update Shadow Mind config', kind: 'execute' }),
  }))
}
