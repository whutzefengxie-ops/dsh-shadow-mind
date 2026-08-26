import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { CallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type ShadowMindRuntime from '../src/runtime/index.ts'
import { resolveSettings } from '../src/runtime/config.ts'
import type {
  CreateShadowDefinition,
  ShadowDefinition,
  ShadowMindSettings,
  ShadowMindStatus,
  UpdateShadowDefinition,
  UpdateShadowMindSettings,
} from '../src/runtime/index.ts'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import ApprovalService, { type ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import * as toolShadowMind from '../src/tool/index.ts'

const testSignal = new AbortController().signal

/** In-memory runtime view that records only management operations owned by this tool package. */
class RuntimeStub {
  readonly definitions = new Map<string, ShadowDefinition>()
  settings = resolveSettings()
  paused = false
  lastRun: ShadowMindStatus['lastRun']

  listDefinitions() {
    return Promise.resolve({ definitions: [...this.definitions.values()], diagnostics: [] })
  }

  createDefinition(input: CreateShadowDefinition): Promise<ShadowDefinition> {
    const definition: ShadowDefinition = {
      ...input,
      capture: input.capture ?? 'full',
      context: input.context ?? 'standard',
      thinkFirst: input.thinkFirst ?? false,
      preFilters: input.preFilters ?? [],
      boostFilters: input.boostFilters ?? [],
      boostFactor: input.boostFactor ?? 1,
      holdout: input.holdout ?? false,
      sourcePath: `/shadow-minds/${input.id}.md`,
    }
    this.definitions.set(input.id, definition)
    return Promise.resolve(definition)
  }

  updateDefinition(id: string, patch: UpdateShadowDefinition): Promise<ShadowDefinition> {
    const current = this.definitions.get(id)
    if (current === undefined) return Promise.reject(new Error(`missing ${id}`))
    const merged = { ...current, ...patch }
    const definition: ShadowDefinition = {
      id: current.id,
      sourcePath: current.sourcePath,
      name: merged.name,
      enabled: merged.enabled,
      debug: merged.debug,
      activationProbability: merged.activationProbability,
      activeForModels: merged.activeForModels,
      ...merged.runWithModel == null ? {} : { runWithModel: merged.runWithModel },
      ...merged.reasoningEffort == null ? {} : { reasoningEffort: merged.reasoningEffort },
      ...merged.timeoutSeconds == null ? {} : { timeoutSeconds: merged.timeoutSeconds },
      tools: merged.tools,
      capture: merged.capture ?? 'full',
      context: merged.context ?? 'standard',
      thinkFirst: merged.thinkFirst ?? false,
      preFilters: merged.preFilters ?? [],
      boostFilters: merged.boostFilters ?? [],
      boostFactor: merged.boostFactor ?? 1,
      holdout: merged.holdout ?? false,
      prompt: merged.prompt,
    }
    this.definitions.set(id, definition)
    return Promise.resolve(definition)
  }

  setEnabled(id: string, enabled: boolean): Promise<ShadowDefinition> {
    return this.updateDefinition(id, { enabled })
  }

  deleteDefinition(id: string): Promise<void> {
    this.definitions.delete(id)
    return Promise.resolve()
  }

  currentSettings(): ShadowMindSettings {
    return this.settings
  }

  updateSettings(patch: UpdateShadowMindSettings): Promise<void> {
    const next = { ...this.settings } as Record<string, unknown>
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) Reflect.deleteProperty(next, key)
      else next[key] = value
    }
    this.settings = next as unknown as ShadowMindSettings
    return Promise.resolve()
  }

  status(): ShadowMindStatus {
    return {
      paused: this.paused,
      active: [],
      pendingSchedules: 0,
      epoch: 0,
      totalRuns: 0,
      prefilterSkips: 0,
      effectiveProbabilities: [],
      valueLoop: [],
      spentChars: 0,
      budgetTier: 'standard',
      cooldowns: [],
      pendingEscalations: [],
      recentReviews: [],
      synthesisRuns: 0,
      synthesisFailures: 0,
      gateDenies: 0,
      gateAllows: 0,
      gateJudgeRuns: 0,
      gateJudgeFailures: 0,
      ...this.lastRun === undefined ? {} : { lastRun: this.lastRun },
    }
  }

  pause(): ShadowMindStatus {
    this.paused = true
    return this.status()
  }

  resume(): ShadowMindStatus {
    this.paused = false
    return this.status()
  }

  toggle(): ShadowMindStatus {
    this.paused = !this.paused
    return this.status()
  }
}

async function setup(outcome: ApprovalOutcome = 'allowed-once') {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(ApprovalService, { policy: 'ask' })
  const runtime = new RuntimeStub()
  ctx.provide('shadowMind', runtime as unknown as ShadowMindRuntime)
  ctx.on('approval/request', () => Promise.resolve(outcome))
  const plugin = await ctx.plugin(toolShadowMind)
  const session = ctx.sessions.create(SessionId('tool-shadow-root'))
  session.append('turn/start', { turn: 1 })
  const agent = { id: session.id, session, status: 'idle' } as Agent
  return { ctx, runtime, plugin, agent }
}

async function execute(
  ctx: Context,
  agent: Agent | undefined,
  name: string,
  args: Record<string, unknown>,
) {
  return ctx.tools.execute({
    signal: testSignal,
    callId: CallId(`call-${name}`),
    name,
    arguments: args,
    ...agent === undefined ? {} : { agent },
  })
}

function present(ctx: Context, agent: Agent, name: string, args: Record<string, unknown>) {
  const tool = ctx.tools.get(name, agent)
  if (tool?.presentCall === undefined) throw new Error(`tool ${name} has no call presentation`)
  return tool.presentCall(args)
}

describe('Shadow Mind management tools and command', () => {
  it('keeps its namespace exports intact through the Cordis Loader', async () => {
    const ctx = new Context()
    await ctx.plugin(Loader)
    expect('default' in toolShadowMind).toBe(false)
    expect(ctx.loader.unwrapExports(toolShadowMind)).toBe(toolShadowMind)
  })

  it('registers the complete management set and removes every contribution on dispose', async () => {
    const { ctx, plugin, agent } = await setup()
    expect(ctx.tools.schemas(agent).map(schema => schema.name)).toEqual([
      'list_shadows',
      'create_shadow',
      'update_shadow',
      'enable_shadow',
      'disable_shadow',
      'delete_shadow',
      'get_shadow_config',
      'update_shadow_config',
    ])
    expect(ctx.commands.find(agent, 'shadow')).toBeDefined()

    await plugin.dispose()

    expect(ctx.tools.schemas(agent)).toEqual([])
    expect(ctx.commands.find(agent, 'shadow')).toBeUndefined()
  })

  it('requires allowed-once before creating a definition', async () => {
    const denied = await setup('rejected')
    const args = { id: 'security', name: 'Security', prompt: 'Review security risks.' }
    const deniedResult = await execute(denied.ctx, denied.agent, 'create_shadow', args)
    expect(deniedResult.isError).toBe(true)
    expect(denied.runtime.definitions.size).toBe(0)
    const decisions = denied.agent.session.events.filter(event => event.type === 'approval/decided')
    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.data.outcome).toBe('rejected')

    const allowed = await setup()
    const allowedResult = await execute(allowed.ctx, allowed.agent, 'create_shadow', args)
    expect(allowedResult.isError).toBe(false)
    expect(allowed.runtime.definitions.get('security')).toMatchObject({
      id: 'security',
      enabled: true,
      debug: false,
      activationProbability: 0.3,
      tools: [],
    })
  })

  it('updates definitions, settings, and the root command through their public entries', async () => {
    const { ctx, runtime, agent } = await setup()
    await runtime.createDefinition({
      id: 'reviewer',
      name: 'Reviewer',
      enabled: true,
      debug: false,
      activationProbability: 1,
      activeForModels: [],
      tools: [],
      prompt: 'Review.',
    })

    expect((await execute(ctx, agent, 'disable_shadow', { id: 'reviewer' })).isError).toBe(false)
    expect(runtime.definitions.get('reviewer')?.enabled).toBe(false)
    expect((await execute(ctx, agent, 'update_shadow', { id: 'reviewer', prompt: 'Review deeply.' })).isError)
      .toBe(false)
    expect(runtime.definitions.get('reviewer')?.prompt).toBe('Review deeply.')
    expect((await execute(ctx, agent, 'update_shadow_config', { maxParallelShadows: 4 })).isError).toBe(false)
    expect(runtime.settings.maxParallelShadows).toBe(4)

    const status = await ctx.commands.execute(agent, '/shadow', [], testSignal)
    expect(status?.result.kind).toBe('success')
    expect(status?.result.kind === 'success' ? status.result.text : '').toBe(
      'Shadow Mind active; 0 running; 0 pending schedules; 0 total runs; 0 prefilter skips; standard budget (0 chars); 0 syntheses/0 failed; 0 recent reports; no completed runs.',
    )
    const paused = await ctx.commands.execute(agent, '/shadow pause', [], testSignal)
    expect(paused?.result.kind).toBe('success')
    expect(paused?.result.kind === 'success' ? paused.result.text : '').toContain('paused')
    const resumed = await ctx.commands.execute(agent, '/shadow resume', [], testSignal)
    expect(resumed?.result.kind).toBe('success')
    expect(resumed?.result.kind === 'success' ? resumed.result.text : '').toContain('active')
    const toggled = await ctx.commands.execute(agent, '/shadow toggle', [], testSignal)
    expect(toggled?.result.kind).toBe('success')
    expect(toggled?.result.kind === 'success' ? toggled.result.text : '').toContain('paused')
    const explicitStatus = await ctx.commands.execute(agent, '/shadow status', [], testSignal)
    expect(explicitStatus?.result.kind).toBe('success')
    expect(explicitStatus?.result.kind === 'success' ? explicitStatus.result.text : '').toContain('paused')
    const invalid = await ctx.commands.execute(agent, '/shadow unknown', [], testSignal)
    expect(invalid?.result).toEqual({ kind: 'error', text: 'Usage: /shadow [status|pause|resume|toggle]' })

    runtime.lastRun = {
      runId: 'run-reviewer',
      shadowId: 'reviewer',
      shadowName: 'Reviewer',
      capturedThroughSeq: 1,
      finishedAt: '2026-08-25T00:00:00.000Z',
      outcome: 'report',
      stage: 'relay',
      deliberationChars: 12,
      independence: 'independent',
    }
    const completed = await ctx.commands.execute(agent, '/shadow status', [], testSignal)
    expect(completed?.result.kind === 'success' ? completed.result.text : '').toContain(
      'last reviewer report at 2026-08-25T00:00:00.000Z',
    )
  })

  it('executes every management operation and projects every presentation', async () => {
    const { ctx, runtime, agent } = await setup()
    const input = {
      id: 'full',
      name: 'Full definition',
      enabled: false,
      debug: true,
      activation_probability: 0.8,
      active_for_models: ['mock/*'],
      run_with_model: 'mock/shadow',
      reasoning_effort: 'high',
      timeout_seconds: 7,
      tools: ['custom_read'],
      capture: 'since-compaction',
      context: 'minimal',
      think_first: true,
      pre_filter: ['tool-failure'],
      boost_filter: ['long-output'],
      boost_factor: 2,
      holdout: true,
      prompt: 'Review every field.',
    }

    expect((await execute(ctx, undefined, 'create_shadow', input)).isError).toBe(true)
    expect((await execute(ctx, agent, 'create_shadow', input)).isError).toBe(false)
    expect(runtime.definitions.get('full')).toMatchObject({
      activationProbability: 0.8,
      activeForModels: ['mock/*'],
      runWithModel: 'mock/shadow',
      reasoningEffort: 'high',
      timeoutSeconds: 7,
      tools: ['custom_read'],
      capture: 'since-compaction',
      context: 'minimal',
      thinkFirst: true,
      preFilters: ['tool-failure'],
      boostFilters: ['long-output'],
      boostFactor: 2,
      holdout: true,
    })

    const listed = await execute(ctx, agent, 'list_shadows', {})
    expect(JSON.stringify(listed.content)).toContain('Full definition')
    expect(JSON.stringify(listed.content)).not.toContain('holdout_keys')
    expect((await execute(ctx, agent, 'update_shadow', { id: 'full' })).isError).toBe(true)
    expect((await execute(ctx, agent, 'update_shadow', {
      id: 'full',
      name: 'Updated',
      enabled: true,
      debug: false,
      activation_probability: 0.2,
      active_for_models: ['other/*'],
      run_with_model: 'other/shadow',
      reasoning_effort: 'medium',
      timeout_seconds: 9,
      tools: ['read_extra'],
      capture: 'full',
      context: 'standard',
      think_first: false,
      pre_filter: ['last-report-covers'],
      boost_filter: ['repeated-failure'],
      boost_factor: 3,
      holdout: false,
      prompt: 'Updated prompt.',
    })).isError).toBe(false)
    expect((await execute(ctx, agent, 'update_shadow', {
      id: 'full',
      run_with_model: null,
      reasoning_effort: null,
      timeout_seconds: null,
    })).isError).toBe(false)
    expect(runtime.definitions.get('full')).not.toHaveProperty('runWithModel')
    expect(runtime.definitions.get('full')).not.toHaveProperty('reasoningEffort')
    expect(runtime.definitions.get('full')).not.toHaveProperty('timeoutSeconds')
    expect((await execute(ctx, agent, 'enable_shadow', { id: 'full' })).isError).toBe(false)
    expect((await execute(ctx, agent, 'disable_shadow', { id: 'full' })).isError).toBe(false)

    const current = await execute(ctx, agent, 'get_shadow_config', {})
    expect(JSON.stringify(current.content)).toContain('heartbeatProbability')
    expect((await execute(ctx, agent, 'update_shadow_config', {})).isError).toBe(true)
    expect((await execute(ctx, agent, 'update_shadow_config', {
      heartbeatProbability: 0.5,
      maxParallelShadows: 2,
      defaultShadowTimeoutSeconds: 3,
      headlessDrainTimeoutSeconds: 4,
      resultBatchWindowMs: 5,
      defaultShadowModel: 'mock/model',
      defaultReasoningEffort: 'high',
      argumentDisclosure: 'full',
      randomSeed: 7,
      maxPromptChars: 1_000,
      maxReportChars: 500,
      preferIndependentVendor: true,
      longOutputBoostChars: 200,
      lastReportCoversCount: 3,
      repeatedFailureBoostThreshold: 4,
      valueLoopEnabled: false,
      valueLoopWindowTurns: 3,
      reviewWindowSize: 8,
      spinningRepeatCount: 3,
      oscillationPeriods: 2,
      noDriftRepeatCount: 3,
      diminishingWindowSize: 5,
      diminishingNoveltyThreshold: 0.25,
      stagnationCooldownSeconds: 30,
      stagnationEscalationEnabled: true,
      reasoningEffortLadder: ['low', 'high'],
      sessionShadowSoftBudgetChars: 10_000,
      sessionShadowHardBudgetChars: 20_000,
      frugalShadowModel: 'mock/frugal',
      staleReportDecay: 0.2,
      conflictSynthesisEnabled: true,
      conflictSynthesisTimeoutSeconds: 6,
    })).isError).toBe(false)
    expect(runtime.settings).toMatchObject({
      defaultShadowModel: 'mock/model',
      argumentDisclosure: 'full',
      preferIndependentVendor: true,
      valueLoopEnabled: false,
      reasoningEffortLadder: ['low', 'high'],
      frugalShadowModel: 'mock/frugal',
      conflictSynthesisEnabled: true,
    })
    expect((await execute(ctx, agent, 'update_shadow_config', {
      defaultShadowModel: null,
      defaultReasoningEffort: null,
      randomSeed: null,
      sessionShadowSoftBudgetChars: null,
      sessionShadowHardBudgetChars: null,
      frugalShadowModel: null,
    })).isError).toBe(false)
    expect(runtime.settings).not.toHaveProperty('defaultShadowModel')
    expect(runtime.settings).not.toHaveProperty('defaultReasoningEffort')
    expect(runtime.settings).not.toHaveProperty('randomSeed')
    expect(runtime.settings).not.toHaveProperty('sessionShadowSoftBudgetChars')
    expect(runtime.settings).not.toHaveProperty('sessionShadowHardBudgetChars')
    expect(runtime.settings).not.toHaveProperty('frugalShadowModel')

    expect(present(ctx, agent, 'list_shadows', {})).toEqual({ card: 'generic', title: 'List Shadow Minds', kind: 'read' })
    expect(present(ctx, agent, 'create_shadow', input)).toMatchObject({ title: 'Create Shadow full', rawInput: 'full' })
    expect(present(ctx, agent, 'update_shadow', { id: 'full' })).toMatchObject({ title: 'Update Shadow full' })
    expect(present(ctx, agent, 'enable_shadow', { id: 'full' })).toMatchObject({ title: 'Enable Shadow full' })
    expect(present(ctx, agent, 'disable_shadow', { id: 'full' })).toMatchObject({ title: 'Disable Shadow full' })
    expect(present(ctx, agent, 'delete_shadow', { id: 'full' })).toMatchObject({ title: 'Delete Shadow full' })
    expect(present(ctx, agent, 'get_shadow_config', {})).toMatchObject({ title: 'Read Shadow Mind config' })
    expect(present(ctx, agent, 'update_shadow_config', {})).toMatchObject({ title: 'Update Shadow Mind config' })
    expect(ctx.tools.get('list_shadows', agent)?.output.render({}, { result: 'rendered' }))
      .toEqual([{ type: 'text', text: 'rendered' }])

    expect((await execute(ctx, agent, 'delete_shadow', { id: 'full' })).isError).toBe(false)
    expect(runtime.definitions.has('full')).toBe(false)
  })
})
