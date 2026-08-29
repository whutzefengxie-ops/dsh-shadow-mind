import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type ShadowMindRuntime from '../src/runtime/index.ts'
import { resolveSettings } from '../src/runtime/config.ts'
import type {
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindSettings,
  ShadowMindStatus,
  UpdateShadowMindSettings,
} from '../src/runtime/index.ts'
import { DEFAULT_SHADOW_ID } from '../src/runtime/index.ts'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import ApprovalService, { type ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import * as toolShadowMind from '../src/tool/index.ts'

const testSignal = new AbortController().signal

/** In-memory runtime view that records only management operations owned by this tool package. */
class RuntimeStub {
  readonly definitions = new Map<string, ShadowDefinition>()
  settings = resolveSettings()
  lastRun: ShadowMindStatus['lastRun']
  totalRuns = 0
  admitted = 0
  retried: string[] = []
  reviewed = 0

  constructor() {
    this.definitions.set(DEFAULT_SHADOW_ID, {
      id: DEFAULT_SHADOW_ID,
      name: 'Shadow',
      enabled: true,
      debug: false,
      activationProbability: 0.7,
      activeForModels: [],
      tools: [],
      capture: 'full',
      context: 'standard',
      thinkFirst: false,
      holdout: false,
      prompt: 'Review.',
      sourcePath: `/shadow-minds/${DEFAULT_SHADOW_ID}.md`,
    })
  }

  listDefinitions() {
    return Promise.resolve({ definitions: [...this.definitions.values()], diagnostics: [] })
  }

  saveDefaultDefinition(input: ShadowDefinitionInput): Promise<ShadowDefinition> {
    if (input.id !== DEFAULT_SHADOW_ID) return Promise.reject(new Error('only the default Shadow can be saved'))
    const definition: ShadowDefinition = {
      id: input.id,
      name: input.name,
      enabled: input.enabled,
      debug: input.debug,
      activationProbability: input.activationProbability,
      activeForModels: input.activeForModels,
      ...input.runWithModel === null ? {} : { runWithModel: input.runWithModel },
      ...input.reasoningEffort === null ? {} : { reasoningEffort: input.reasoningEffort },
      ...input.timeoutSeconds === null ? {} : { timeoutSeconds: input.timeoutSeconds },
      tools: input.tools,
      capture: input.capture,
      context: input.context,
      thinkFirst: input.thinkFirst,
      holdout: input.holdout,
      prompt: input.prompt,
      sourcePath: `/shadow-minds/${input.id}.md`,
    }
    this.definitions.set(input.id, definition)
    return Promise.resolve(definition)
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
      paused: false,
      active: this.admitted > 0 ? [{
        runId: `run-${String(this.admitted)}`,
        shadowId: DEFAULT_SHADOW_ID,
        shadowName: 'Shadow',
        capturedThroughSeq: 1,
        stage: 'prepare',
      }] : [],
      pendingSchedules: 0,
      epoch: 0,
      totalRuns: this.totalRuns,
      valueLoop: [],
      spentChars: 0,
      budgetTier: 'standard',
      cooldowns: [],
      pendingEscalations: [],
      recentReviews: [],
      ...this.lastRun === undefined ? {} : { lastRun: this.lastRun },
    }
  }

  retryLatest(): Promise<ShadowMindStatus> {
    if (this.lastRun === undefined
      || (this.lastRun.outcome !== 'failed' && this.lastRun.outcome !== 'aborted')) {
      return Promise.reject(new Error('this session has no failed or aborted Shadow run to retry'))
    }
    this.retried.push(this.lastRun.runId)
    this.admitted += 1
    this.totalRuns += 1
    return Promise.resolve(this.status())
  }

  reviewNow(): Promise<ShadowMindStatus> {
    if (this.totalRuns > 0) {
      return Promise.reject(new Error(
        `this session has already admitted ${this.totalRuns} Shadow run(s); use /shadow retry to rerun a failed review`,
      ))
    }
    this.reviewed += 1
    this.admitted += 1
    this.totalRuns += 1
    return Promise.resolve(this.status())
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
    callId: ToolCallId(`call-${name}`),
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
      'update_default_shadow',
      'get_shadow_config',
      'update_shadow_config',
    ])
    expect(ctx.commands.find(agent, 'shadow')).toBeDefined()

    await plugin.dispose()

    expect(ctx.tools.schemas(agent)).toEqual([])
    expect(ctx.commands.find(agent, 'shadow')).toBeUndefined()
  })

  it('requires allowed-once before updating the default Shadow', async () => {
    const denied = await setup('rejected')
    const args = { name: 'Security', prompt: 'Review security risks.' }
    const deniedResult = await execute(denied.ctx, denied.agent, 'update_default_shadow', args)
    expect(deniedResult.isError).toBe(true)
    expect(denied.runtime.definitions.get(DEFAULT_SHADOW_ID)?.name).toBe('Shadow')
    const decisions = denied.agent.session.events.filter(event => event.type === 'approval/decided')
    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.data.outcome).toBe('rejected')

    const allowed = await setup()
    const allowedResult = await execute(allowed.ctx, allowed.agent, 'update_default_shadow', args)
    expect(allowedResult.isError).toBe(false)
    expect(allowed.runtime.definitions.get(DEFAULT_SHADOW_ID)).toMatchObject({
      id: DEFAULT_SHADOW_ID,
      name: 'Security',
      prompt: 'Review security risks.',
    })
  })

  it('rejects empty updates, missing defaults, and requires a calling agent', async () => {
    const { ctx, runtime, agent } = await setup()
    expect((await execute(ctx, undefined, 'update_default_shadow', { name: 'X' })).isError).toBe(true)
    expect((await execute(ctx, agent, 'update_default_shadow', {})).isError).toBe(true)
    runtime.definitions.delete(DEFAULT_SHADOW_ID)
    expect((await execute(ctx, agent, 'update_default_shadow', { name: 'X' })).isError).toBe(true)
  })

  it('updates the default Shadow and settings through their public entries', async () => {
    const { ctx, runtime, agent } = await setup()

    expect((await execute(ctx, agent, 'update_default_shadow', {
      name: 'Updated',
      enabled: false,
      activation_probability: 0.4,
      run_with_model: 'mock/shadow',
      reasoning_effort: 'high',
      timeout_seconds: 7,
      tools: ['custom_read'],
      capture: 'since-compaction',
      context: 'minimal',
      think_first: true,
      prompt: 'Review deeply.',
    })).isError).toBe(false)
    expect(runtime.definitions.get(DEFAULT_SHADOW_ID)).toMatchObject({
      name: 'Updated',
      enabled: false,
      activationProbability: 0.4,
      runWithModel: 'mock/shadow',
      reasoningEffort: 'high',
      timeoutSeconds: 7,
      tools: ['custom_read'],
      capture: 'since-compaction',
      context: 'minimal',
      thinkFirst: true,
      prompt: 'Review deeply.',
    })

    expect((await execute(ctx, agent, 'update_default_shadow', {
      run_with_model: null,
      reasoning_effort: null,
      timeout_seconds: null,
    })).isError).toBe(false)
    expect(runtime.definitions.get(DEFAULT_SHADOW_ID)).not.toHaveProperty('runWithModel')
    expect(runtime.definitions.get(DEFAULT_SHADOW_ID)).not.toHaveProperty('reasoningEffort')
    expect(runtime.definitions.get(DEFAULT_SHADOW_ID)).not.toHaveProperty('timeoutSeconds')

    expect((await execute(ctx, agent, 'update_shadow_config', { defaultShadowTimeoutSeconds: 3 })).isError)
      .toBe(false)
    expect(runtime.settings.defaultShadowTimeoutSeconds).toBe(3)
  })

  it('runs the two human commands: retry for the latest failure and new for untouched sessions', async () => {
    const { ctx, runtime, agent } = await setup()

    const empty = await ctx.commands.execute(agent, '/shadow', [], testSignal)
    expect(empty?.result).toEqual({ kind: 'error', text: 'Usage: /shadow [retry|new]' })
    const legacy = await ctx.commands.execute(agent, '/shadow status', [], testSignal)
    expect(legacy?.result).toEqual({ kind: 'error', text: 'Usage: /shadow [retry|new]' })

    const noFailure = await ctx.commands.execute(agent, '/shadow retry', [], testSignal)
    expect(noFailure?.result).toEqual({
      kind: 'error',
      text: 'this session has no failed or aborted Shadow run to retry',
    })

    const fresh = await ctx.commands.execute(agent, '/shadow new', [], testSignal)
    expect(fresh?.result).toEqual({
      kind: 'success',
      text: 'Shadow new admitted; 1 running: default/run-1.',
    })
    expect(runtime.reviewed).toBe(1)
    expect(runtime.retried).toEqual([])

    const repeated = await ctx.commands.execute(agent, '/shadow new', [], testSignal)
    expect(repeated?.result).toEqual({
      kind: 'error',
      text: 'this session has already admitted 1 Shadow run(s); use /shadow retry to rerun a failed review',
    })

    runtime.lastRun = {
      runId: 'run-failed',
      shadowId: DEFAULT_SHADOW_ID,
      shadowName: 'Shadow',
      capturedThroughSeq: 1,
      finishedAt: '2026-08-25T00:00:00.000Z',
      outcome: 'failed',
      stage: 'run',
      deliberationChars: 12,
      independence: 'independent',
    }
    const retried = await ctx.commands.execute(agent, '/shadow retry', [], testSignal)
    expect(retried?.result).toEqual({
      kind: 'success',
      text: 'Shadow retry admitted; 1 running: default/run-2.',
    })
    expect(runtime.retried).toEqual(['run-failed'])
    expect(runtime.reviewed).toBe(1)

    runtime.lastRun = {
      runId: 'run-reported',
      shadowId: DEFAULT_SHADOW_ID,
      shadowName: 'Shadow',
      capturedThroughSeq: 2,
      finishedAt: '2026-08-25T00:00:01.000Z',
      outcome: 'report',
      stage: 'relay',
      deliberationChars: 12,
      independence: 'independent',
    }
    const noRetryable = await ctx.commands.execute(agent, '/shadow retry', [], testSignal)
    expect(noRetryable?.result).toEqual({
      kind: 'error',
      text: 'this session has no failed or aborted Shadow run to retry',
    })
  })

  it('executes every management operation and projects every presentation', async () => {
    const { ctx, runtime, agent } = await setup()

    expect((await execute(ctx, agent, 'update_default_shadow', { prompt: 'Review every field.' })).isError)
      .toBe(false)

    const listed = await execute(ctx, agent, 'list_shadows', {})
    expect(JSON.stringify(listed.content)).toContain('Review every field.')
    expect(JSON.stringify(listed.content)).not.toContain('holdout_keys')

    const current = await execute(ctx, agent, 'get_shadow_config', {})
    expect(JSON.stringify(current.content)).toContain('defaultShadowTimeoutSeconds')
    expect((await execute(ctx, agent, 'update_shadow_config', {})).isError).toBe(true)
    expect((await execute(ctx, agent, 'update_shadow_config', {
      defaultShadowTimeoutSeconds: 3,
      headlessDrainTimeoutSeconds: 4,
      resultBatchWindowMs: 5,
      argumentDisclosure: 'full',
      randomSeed: 7,
      maxPromptChars: 1_000,
      maxReportChars: 500,
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
    })).isError).toBe(false)
    expect(runtime.settings).toMatchObject({
      argumentDisclosure: 'full',
      valueLoopEnabled: false,
      reasoningEffortLadder: ['low', 'high'],
      frugalShadowModel: 'mock/frugal',
    })
    expect((await execute(ctx, agent, 'update_shadow_config', {
      randomSeed: null,
      sessionShadowSoftBudgetChars: null,
      sessionShadowHardBudgetChars: null,
      frugalShadowModel: null,
    })).isError).toBe(false)
    expect(runtime.settings).not.toHaveProperty('randomSeed')
    expect(runtime.settings).not.toHaveProperty('sessionShadowSoftBudgetChars')
    expect(runtime.settings).not.toHaveProperty('sessionShadowHardBudgetChars')
    expect(runtime.settings).not.toHaveProperty('frugalShadowModel')

    expect(present(ctx, agent, 'list_shadows', {})).toEqual({ card: 'generic', title: 'List Shadow Minds', kind: 'read' })
    expect(present(ctx, agent, 'update_default_shadow', {})).toMatchObject({
      title: 'Update default Shadow',
      rawInput: DEFAULT_SHADOW_ID,
    })
    expect(present(ctx, agent, 'get_shadow_config', {})).toMatchObject({ title: 'Read Shadow Mind config' })
    expect(present(ctx, agent, 'update_shadow_config', {})).toMatchObject({ title: 'Update Shadow Mind config' })
    expect(ctx.tools.get('list_shadows', agent)?.output.render({}, { result: 'rendered' }))
      .toEqual([{ type: 'text', text: 'rendered' }])
  })
})
