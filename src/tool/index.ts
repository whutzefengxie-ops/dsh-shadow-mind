/** Model management tools and the `/shadow` root-agent command. @module @deepseek-ai/dsh-tool-shadow-mind */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-user-approval'
import type {
  CreateShadowDefinition,
  ShadowDefinition,
  ShadowMindSettings,
  UpdateShadowDefinition,
} from '../runtime/index.ts'

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
    prompt: definition.prompt,
  }
}

/** Stable pretty JSON for management-tool output. */
function result(value: unknown): { result: string } {
  return { result: JSON.stringify(value, null, 2) }
}

/** Recover the definition id type after tool schema validation. */
function shadowId(value: unknown): string {
  return value as string
}

/** Definition authoring parameter schema shared conceptually by create and update. */
const DEFINITION_PARAMETERS = {
  name: { type: 'string' as const, description: 'Human-readable Shadow name.' },
  enabled: { type: 'boolean' as const, description: 'Whether automatic scheduling may select this Shadow.' },
  debug: { type: 'boolean' as const, description: 'Whether completed runs append local JSONL diagnostics.' },
  activation_probability: { type: 'number' as const, description: 'Independent probability from 0 through 1.' },
  active_for_models: {
    type: 'array' as const,
    description: 'Optional model or provider/model glob filters.',
    items: { type: 'string' as const },
  },
  run_with_model: {
    oneOf: [{ type: 'string' as const }, { type: 'null' as const }] as const,
    description: 'Optional provider/model route; null clears the override.',
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
  prompt: { type: 'string' as const, description: 'Non-empty Shadow instructions.' },
}

/** Register all Shadow management tools and the human command. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'shadow',
    description: 'Show, pause, resume, or toggle Shadow Mind scheduling',
    input: { hint: '[status|pause|resume|toggle]', images: false },
    handler: ({ agent, rawInput }) => {
      const operation = rawInput.trim() || 'status'
      const status = operation === 'status'
        ? ctx.shadowMind.status(agent)
        : operation === 'pause'
          ? ctx.shadowMind.pause(agent)
          : operation === 'resume'
            ? ctx.shadowMind.resume(agent)
            : operation === 'toggle'
              ? ctx.shadowMind.toggle(agent)
              : undefined
      if (status === undefined) return { kind: 'error', text: 'Usage: /shadow [status|pause|resume|toggle]' }
      const lastRun = status.lastRun === undefined
        ? 'no completed runs'
        : `last ${status.lastRun.shadowId} ${status.lastRun.outcome} at ${status.lastRun.finishedAt}`
      return {
        kind: 'success',
        text: `Shadow Mind ${status.paused ? 'paused' : 'active'}; ${String(status.active.length)} running; ${String(status.pendingSchedules)} pending schedules; ${String(status.totalRuns)} total runs; ${lastRun}.`,
      }
    },
  })

  ctx.tools.register(defineTool({
    name: 'list_shadows',
    description: 'List Shadow Mind definitions and isolated file diagnostics. This does not start a Shadow.',
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
    name: 'create_shadow',
    description: 'Create one Markdown-backed Shadow definition. This changes local configuration and requires user approval.',
    parameters: {
      id: { type: 'string', required: true, description: 'Lowercase stable id used as the filename.' },
      ...DEFINITION_PARAMETERS,
      name: { ...DEFINITION_PARAMETERS.name, required: true },
      prompt: { ...DEFINITION_PARAMETERS.prompt, required: true },
    },
    output: textOutput(),
    execute: async (args, exec) => {
      const id = shadowId(args.id)
      await approve(ctx, exec, `Create Shadow definition ${id}`)
      const input: CreateShadowDefinition = {
        id,
        name: args.name,
        enabled: args.enabled ?? true,
        debug: args.debug ?? false,
        activationProbability: args.activation_probability ?? 0.3,
        activeForModels: args.active_for_models ?? [],
        ...args.run_with_model == null ? {} : { runWithModel: args.run_with_model },
        ...args.reasoning_effort == null ? {} : { reasoningEffort: args.reasoning_effort },
        ...args.timeout_seconds == null ? {} : { timeoutSeconds: args.timeout_seconds },
        tools: args.tools ?? [],
        prompt: args.prompt,
      }
      return result(definitionView(await ctx.shadowMind.createDefinition(input)))
    },
    presentCall: (args) => {
      const id = shadowId(args.id)
      return { card: 'generic', title: `Create Shadow ${id}`, kind: 'execute', rawInput: id }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'update_shadow',
    description: 'Update selected fields of one Shadow definition. This changes local configuration and requires user approval.',
    parameters: {
      id: { type: 'string', required: true, description: 'Existing Shadow id.' },
      ...DEFINITION_PARAMETERS,
    },
    output: textOutput(),
    execute: async (args, exec) => {
      const id = shadowId(args.id)
      const patch: UpdateShadowDefinition = {
        ...args.name === undefined ? {} : { name: args.name },
        ...args.enabled === undefined ? {} : { enabled: args.enabled },
        ...args.debug === undefined ? {} : { debug: args.debug },
        ...args.activation_probability === undefined ? {} : { activationProbability: args.activation_probability },
        ...args.active_for_models === undefined ? {} : { activeForModels: args.active_for_models },
        ...args.run_with_model === undefined ? {} : { runWithModel: args.run_with_model ?? undefined },
        ...args.reasoning_effort === undefined ? {} : { reasoningEffort: args.reasoning_effort ?? undefined },
        ...args.timeout_seconds === undefined ? {} : { timeoutSeconds: args.timeout_seconds ?? undefined },
        ...args.tools === undefined ? {} : { tools: args.tools },
        ...args.prompt === undefined ? {} : { prompt: args.prompt },
      }
      if (Object.keys(patch).length === 0) throw new Error('update_shadow requires at least one field to update')
      await approve(ctx, exec, `Update Shadow definition ${id}`)
      return result(definitionView(await ctx.shadowMind.updateDefinition(id, patch)))
    },
    presentCall: (args) => {
      const id = shadowId(args.id)
      return { card: 'generic', title: `Update Shadow ${id}`, kind: 'execute', rawInput: id }
    },
  }))

  for (const [toolName, enabled] of [['enable_shadow', true], ['disable_shadow', false]] as const) {
    ctx.tools.register(defineTool({
      name: toolName,
      description: `${enabled ? 'Enable' : 'Disable'} one Shadow definition. This changes local configuration and requires user approval.`,
      parameters: { id: { type: 'string', required: true, description: 'Existing Shadow id.' } },
      output: textOutput(),
      execute: async (args, exec) => {
        const id = shadowId(args.id)
        await approve(ctx, exec, `${enabled ? 'Enable' : 'Disable'} Shadow definition ${id}`)
        return result(definitionView(await ctx.shadowMind.setEnabled(id, enabled)))
      },
      presentCall: (args) => {
        const id = shadowId(args.id)
        return {
          card: 'generic',
          title: `${enabled ? 'Enable' : 'Disable'} Shadow ${id}`,
          kind: 'execute',
          rawInput: id,
        }
      },
    }))
  }

  ctx.tools.register(defineTool({
    name: 'delete_shadow',
    description: 'Delete one Shadow definition while preserving its debug log. This requires user approval.',
    parameters: { id: { type: 'string', required: true, description: 'Existing Shadow id.' } },
    output: textOutput(),
    execute: async (args, exec) => {
      const id = shadowId(args.id)
      await approve(ctx, exec, `Delete Shadow definition ${id}`)
      await ctx.shadowMind.deleteDefinition(id)
      return result({ deleted: id })
    },
    presentCall: (args) => {
      const id = shadowId(args.id)
      return { card: 'generic', title: `Delete Shadow ${id}`, kind: 'execute', rawInput: id }
    },
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
      heartbeatProbability: { type: 'number', description: 'Turn-level heartbeat probability from 0 through 1.' },
      maxParallelShadows: { type: 'number', description: 'Positive integer concurrency bound per root.' },
      defaultShadowTimeoutSeconds: { type: 'number', description: 'Positive default run deadline.' },
      headlessDrainTimeoutSeconds: { type: 'number', description: 'Positive headless convergence deadline.' },
      resultBatchWindowMs: { type: 'number', description: 'Non-negative report batching window.' },
      defaultShadowModel: { type: 'string', description: 'Fallback provider/model route.' },
      defaultReasoningEffort: { type: 'string', description: 'Fallback adapter-owned reasoning effort.' },
      argumentDisclosure: { type: 'string', enum: ['redacted', 'full'], description: 'Tool-call argument projection policy.' },
      randomSeed: { type: 'number', description: 'Deterministic scheduler seed.' },
      maxPromptChars: { type: 'number', description: 'Positive complete prompt bound.' },
      maxReportChars: { type: 'number', description: 'Positive accepted report bound.' },
    },
    output: textOutput(),
    execute: async (args, exec) => {
      const entries = Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== undefined)
      const patch = Object.fromEntries(entries) as Partial<ShadowMindSettings>
      if (Object.keys(patch).length === 0) throw new Error('update_shadow_config requires at least one setting')
      await approve(ctx, exec, 'Update Shadow Mind scheduling configuration')
      await ctx.shadowMind.updateSettings(patch)
      return result(ctx.shadowMind.currentSettings())
    },
    presentCall: () => ({ card: 'generic', title: 'Update Shadow Mind config', kind: 'execute' }),
  }))
}
