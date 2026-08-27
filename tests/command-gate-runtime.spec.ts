import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type {
  ResolvedSubagentStartRequest,
  SubagentCapabilities,
  SubagentProvider,
  SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import ShadowMindRuntime, { SHADOW_MIND_SETTINGS_NAMESPACE } from '../src/runtime/index.ts'
import { MemorySettings } from './memory-settings.ts'

const CAPABILITIES: SubagentCapabilities = {
  outputSchema: true,
  depthLimit: true,
  toolFilter: true,
  persona: true,
  modelSelection: true,
  contextInheritance: true,
  thinkFirst: true,
}

class RecordingProvider implements SubagentProvider {
  readonly name = 'shadow-mind'
  readonly capabilities = CAPABILITIES
  readonly inheritsParentContext = false
  readonly requests: ResolvedSubagentStartRequest[] = []
  verdict: { decision: 'allow' | 'deny'; reason: string } = { decision: 'deny', reason: 'blocked' }

  start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
    this.requests.push(request)
    return Promise.resolve({
      id: SessionId(`gate-child-${this.requests.length}`),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { decision: this.verdict.decision, reason: this.verdict.reason },
      }),
      dispose: () => Promise.resolve(),
    })
  }
}

interface GateHarness {
  readonly ctx: Context
  readonly dshHome: string
  readonly agent: Agent
  readonly provider: RecordingProvider
  readonly runtime: ShadowMindRuntime
  dispose(): Promise<void>
}

const harnesses: GateHarness[] = []

async function setup(): Promise<GateHarness> {
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-shadow-gate-'))
  const ctx = new Context()
  const settingsFiber = ctx.plugin(MemorySettings)
  await settingsFiber
  const agentsFiber = ctx.plugin(AgentRegistry)
  await agentsFiber
  const subagentsFiber = ctx.plugin(SubagentRuntime)
  await subagentsFiber
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  ctx.tools.register(defineTool({
    name: 'pwsh',
    description: 'Fake pwsh for gate integration tests',
    parameters: { command: { type: 'string' }, description: { type: 'string' }, workdir: { type: 'string' } },
    output: {
      schema: {
        type: 'object',
        properties: { ran: { type: 'boolean', const: true, required: true } },
        additionalProperties: false,
      },
      render: () => [{ type: 'text', text: 'ran' }],
    },
    execute: async () => ({ ran: true }),
  }))
  const provider = new RecordingProvider()
  ctx.subagents.registerProvider(provider)
  const shadowFiber = ctx.plugin(ShadowMindRuntime, { dshHome })
  await shadowFiber

  const session = Session.create(SessionId('gate-root-session'))
  const agent = {
    id: session.id,
    session,
    options: { provider: 'test', model: 'test-model' },
    status: 'idle',
    ctx,
    followup: () => undefined,
    steer: () => undefined,
  } as unknown as Agent
  const unregisterAgent = ctx.agents.register(agent)

  const harness: GateHarness = {
    ctx,
    dshHome,
    agent,
    provider,
    runtime: ctx.shadowMind,
    async dispose() {
      await shadowFiber.dispose()
      unregisterAgent()
      await subagentsFiber.dispose()
      await agentsFiber.dispose()
      await settingsFiber.dispose()
      // Windows can hold the gate log briefly after a fire-and-forget write;
      // retry the cleanup instead of flaking on EBUSY.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          await rm(dshHome, { recursive: true, force: true })
          return
        } catch (error: unknown) {
          if (attempt === 9) throw error
          await new Promise<void>(resolveTick => setTimeout(resolveTick, 50))
        }
      }
    },
  }
  harnesses.push(harness)
  return harness
}

async function gateSettings(ctx: Context, entries: Readonly<Record<string, unknown>>): Promise<void> {
  await ctx.settings.mutate(SHADOW_MIND_SETTINGS_NAMESPACE, Object.entries(entries).map(([path, value]) => ({
    op: 'set', path: [path], value,
  })))
}

async function execute(ctx: Context, agent: Agent, command: string) {
  return ctx.tools.execute({
    signal: new AbortController().signal,
    callId: CallId(`gate-${command}`),
    name: 'pwsh',
    arguments: { command },
    agent,
  })
}

function text(result: { content: readonly { type: string; text?: string }[] }): string {
  return result.content.map(block => 'text' in block && block.text !== undefined ? block.text : '').join('')
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(harness => harness.dispose()))
})

describe('command gate inside the runtime', () => {
  it('blocks a root pwsh call through a real judge child and audits the verdict', async () => {
    const harness = await setup()
    const { ctx, agent, provider, runtime } = harness
    await gateSettings(ctx, {
      commandGateEnabled: true,
      commandGateContext: 'production box; never kill prod-api',
      commandGateProtectedProcesses: ['prod-api'],
      commandGateModel: 'gate-route/gate-model',
      commandGateReasoningEffort: 'low',
    })
    provider.verdict = { decision: 'deny', reason: 'deploying into the protected production service' }

    const result = await execute(ctx, agent, 'Invoke-Build -Task Deploy')
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('deploying into the protected production service')

    expect(provider.requests).toHaveLength(1)
    const request = provider.requests[0]
    if (request === undefined) throw new Error('judge request was not recorded')
    expect(request.label).toBe('shadow:command-gate')
    expect(request.maxDepth).toBe(1)
    expect(request.contextInheritance).toBe('none')
    expect(request.toolFilter).toEqual({ allow: [] })
    expect(request.modelSelection).toEqual({
      provider: 'gate-route',
      model: 'gate-model',
      reasoningEffort: 'low',
    })
    const prompt = request.prompt.map(block => 'text' in block ? block.text : '').join('\n')
    expect(prompt).toContain('production box; never kill prod-api')
    expect(prompt).toContain('Protected processes: prod-api')
    expect(prompt).toContain('Invoke-Build -Task Deploy')

    const status = runtime.status(agent)
    expect(status.gateJudgeRuns).toBe(1)
    expect(status.gateDenies).toBe(1)
    expect(status.gateJudgeFailures).toBe(0)

    await vi.waitFor(async () => {
      const log = await readFile(join(harness.dshHome, 'shadow-minds', 'logs', 'command-gate.jsonl'), 'utf8')
      expect(log.trim().split('\n')).toHaveLength(1)
      expect(JSON.parse(log)).toMatchObject({ tier: 'judge', allow: false, tool: 'pwsh' })
    })
  })

  it('denies protected-target commands deterministically without spawning a judge', async () => {
    const harness = await setup()
    const { ctx, agent, provider, runtime } = harness
    await gateSettings(ctx, {
      commandGateEnabled: true,
      commandGateProtectedServices: ['prod-api'],
    })

    const result = await execute(ctx, agent, 'Stop-Service prod-api')
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('protected service "prod-api"')
    expect(provider.requests).toHaveLength(0)
    const status = runtime.status(agent)
    expect(status.gateDenies).toBe(1)
    expect(status.gateJudgeRuns).toBe(0)
  })

  it('falls back to the failure policy when the judge produces no verdict', async () => {
    const harness = await setup()
    const { ctx, agent, runtime } = harness
    await gateSettings(ctx, { commandGateEnabled: true, commandGateOnJudgeFailure: 'allow' })
    harness.provider.verdict = { decision: 'allow', reason: 'unused' }
    // Simulate an invalid structured result by overriding the provider outcome.
    const original = harness.provider.start.bind(harness.provider)
    harness.provider.start = (request: ResolvedSubagentStartRequest) => original(request).then(run => ({
      ...run,
      result: Promise.resolve({ output: [], stopReason: 'completed', structured: { decision: 'maybe' } }),
    }))

    const result = await execute(ctx, agent, 'Invoke-Build -Task BrokenJudge')
    expect(result.isError).toBe(false)
    expect(runtime.status(agent).gateJudgeFailures).toBe(1)
  })

  it('leaves commands alone while the gate is disabled', async () => {
    const harness = await setup()
    const { ctx, agent, provider, runtime } = harness
    const result = await execute(ctx, agent, 'Stop-Process -Name anything')
    expect(result.isError).toBe(false)
    expect(provider.requests).toHaveLength(0)
    expect(runtime.status(agent).gateDenies).toBe(0)
  })

  it('treats a judge that stops without completing as a failure', async () => {
    const harness = await setup()
    const { ctx, agent, runtime } = harness
    await gateSettings(ctx, { commandGateEnabled: true, commandGateOnJudgeFailure: 'deny' })
    const original = harness.provider.start.bind(harness.provider)
    harness.provider.start = (request: ResolvedSubagentStartRequest) => original(request).then(run => ({
      ...run,
      result: Promise.resolve({ output: [], stopReason: 'error', structured: { decision: 'deny', reason: 'x' } }),
    }))

    const result = await execute(ctx, agent, 'Invoke-Build -Task StoppedJudge')
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('judge produced no valid verdict (error)')
    expect(runtime.status(agent).gateJudgeFailures).toBe(1)
  })

  it('treats an empty judge reason as a failure instead of relaying it', async () => {
    const harness = await setup()
    const { ctx, agent, runtime } = harness
    await gateSettings(ctx, { commandGateEnabled: true, commandGateOnJudgeFailure: 'deny' })
    const original = harness.provider.start.bind(harness.provider)
    harness.provider.start = (request: ResolvedSubagentStartRequest) => original(request).then(run => ({
      ...run,
      result: Promise.resolve({ output: [], stopReason: 'completed', structured: { decision: 'deny', reason: '   ' } }),
    }))

    const result = await execute(ctx, agent, 'Invoke-Build -Task EmptyReason')
    expect(result.isError).toBe(true)
    expect(runtime.status(agent).gateJudgeFailures).toBe(1)
  })
})
