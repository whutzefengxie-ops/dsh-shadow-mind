import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import {
  CallId,
  createMessage,
  createToolResultMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type {
  ResolvedSubagentStartRequest,
  SubagentCapabilities,
  SubagentProvider,
  SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import ShadowMindRuntime from '../src/runtime/index.ts'

const CAPABILITIES: SubagentCapabilities = {
  outputSchema: true,
  depthLimit: true,
  toolFilter: true,
  persona: true,
}

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }

  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

class StubProvider implements SubagentProvider {
  readonly name = 'shadow-mind'
  readonly capabilities = CAPABILITIES
  readonly inheritsParentContext = false

  constructor(private readonly createRun: (request: ResolvedSubagentStartRequest) => SubagentRun) {}

  start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
    return Promise.resolve(this.createRun(request))
  }
}

interface RuntimeHarness {
  readonly ctx: Context
  readonly dshHome: string
  readonly agent: Agent
  readonly runtime: ShadowMindRuntime
  readonly deliveries: ReturnType<typeof createUserMessage>[]
  dispose(): Promise<void>
}

const harnesses: RuntimeHarness[] = []

interface SetupOptions {
  readonly resultBatchWindowMs?: number
  readonly maxParallelShadows?: number
  readonly conflictSynthesisEnabled?: boolean
  readonly definitions?: Readonly<Record<string, string>>
  readonly holdoutKeys?: Readonly<Record<string, readonly string[]>>
}

async function setup(
  createRun: (request: ResolvedSubagentStartRequest) => SubagentRun,
  options: SetupOptions = {},
): Promise<RuntimeHarness> {
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-shadow-runtime-'))
  const definitionRoot = join(dshHome, 'shadow-minds')
  await mkdir(definitionRoot, { recursive: true })
  const definitions = options.definitions ?? { 'reviewer.md': `---
id: reviewer
name: Reviewer
enabled: true
debug: true
activation_probability: 1
active_for_models:
  - '*'
tools: []
---

Review the completed tool-using turn.
` }
  await Promise.all(Object.entries(definitions).map(async ([filename, content]) => {
    await writeFile(join(definitionRoot, filename), content, 'utf8')
  }))
  if (options.holdoutKeys !== undefined) {
    await writeFile(join(definitionRoot, 'holdout-keys.json'), JSON.stringify(options.holdoutKeys), 'utf8')
  }

  const ctx = new Context()
  const settingsFiber = ctx.plugin(MemorySettings)
  await settingsFiber
  const agentsFiber = ctx.plugin(AgentRegistry)
  await agentsFiber
  const subagentsFiber = ctx.plugin(SubagentRuntime)
  await subagentsFiber
  ctx.subagents.registerProvider(new StubProvider(createRun))
  const shadowFiber = ctx.plugin(ShadowMindRuntime, {
    dshHome,
    heartbeatProbability: 1,
    maxParallelShadows: options.maxParallelShadows ?? 1,
    resultBatchWindowMs: options.resultBatchWindowMs ?? 0,
    conflictSynthesisEnabled: options.conflictSynthesisEnabled ?? false,
  })
  await shadowFiber

  const session = Session.create(SessionId('root-session'))
  const deliveries: ReturnType<typeof createUserMessage>[] = []
  const agent = {
    id: session.id,
    session,
    options: { provider: 'test', model: 'test-model' },
    status: 'idle',
    ctx,
    followup: (message: ReturnType<typeof createUserMessage>) => { deliveries.push(message) },
    steer: (message: ReturnType<typeof createUserMessage>) => { deliveries.push(message) },
  } as unknown as Agent
  const unregisterAgent = ctx.agents.register(agent)

  const harness: RuntimeHarness = {
    ctx,
    dshHome,
    agent,
    runtime: ctx.shadowMind,
    deliveries,
    async dispose() {
      await shadowFiber.dispose()
      unregisterAgent()
      await subagentsFiber.dispose()
      await agentsFiber.dispose()
      await settingsFiber.dispose()
      await rm(dshHome, { recursive: true, force: true })
    },
  }
  harnesses.push(harness)
  return harness
}

function emitToolTurn(harness: RuntimeHarness, turn = 1): number {
  const step = 1
  const callId = CallId(`call-${String(turn)}`)
  const session = harness.agent.session
  session.append('turn/start', { turn })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Inspect the project.' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('step/start', { turn, step })
  session.append('assistant/message', {
    turn,
    step,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'tool-call', id: callId, name: 'read', arguments: '{}' }],
      source: { kind: 'model', provider: 'test', model: 'test-model' },
    }),
  }, { surfaceOp: 'append' })
  session.append('tool/call', { turn, step, callId, name: 'read', arguments: '{}' })
  session.append('tool/result', {
    turn,
    step,
    message: createToolResultMessage({
      callId,
      content: [{ type: 'text', text: 'file contents' }],
      isError: false,
    }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn, step })
  const event = session.append('turn/end', { turn, reason: { kind: 'completed' } })
  harness.ctx.emit('session/event', session, event)
  return event.seq
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(harness => harness.dispose()))
})

describe('Shadow runtime lifecycle', () => {
  it('relays only a validated report and marks its anchored run delivered', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-report'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: {
          status: 'report',
          content: '## Finding\n\n- Fix the defect.',
          verdict: 'challenge',
          refs: [],
        },
      }),
      dispose: () => Promise.resolve(),
    }))
    const capturedThroughSeq = emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)).toMatchObject([{
        capturedThroughSeq,
        scheduling: false,
        runs: [{ phase: 'report', stage: 'relay', relayed: true }],
      }])
    })
    expect(harness.deliveries).toHaveLength(1)
    expect(harness.deliveries[0]?.source).toMatchObject({
      kind: 'shadow-report',
      reports: [{ capturedThroughSeq, childSessionId: 'child-report' }],
    })
  })

  it('aborts a validated report when user input invalidates its pending relay', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-pending-report'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: {
          status: 'report',
          content: 'This report must not survive the user input.',
          verdict: 'challenge',
          refs: [],
        },
      }),
      dispose: () => Promise.resolve(),
    }), { resultBatchWindowMs: 500 })
    emitToolTurn(harness)
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'report',
        stage: 'relay',
        relayed: false,
      })
    })

    harness.ctx.emit('agent/inbox/inserted', {
      agent: harness.agent,
      message: createUserMessage({
        content: [{ type: 'text', text: 'Start a different task.' }],
        source: { kind: 'user' },
      }),
    })

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'aborted',
        stage: 'relay',
        reasonCode: 'USER_MESSAGE_RECEIVED',
        cancellationSource: 'user-input',
        relayed: false,
      })
    })
    expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).not.toHaveProperty('content')
    expect(harness.deliveries).toHaveLength(0)
  })

  it('discards both original reports when user input cancels conflict synthesis', async () => {
    let run = 0
    let synthesisStarted!: () => void
    const started = new Promise<void>((resolve) => { synthesisStarted = resolve })
    const harness = await setup(request => {
      run += 1
      if (run < 3) {
        return {
          id: SessionId(`child-conflict-${String(run)}`),
          localAgent: undefined,
          result: Promise.resolve({
            output: [],
            stopReason: 'completed',
            structured: {
              status: 'report',
              content: `Conflicting report ${String(run)}.`,
              verdict: run === 1 ? 'challenge' : 'confirm',
              refs: [],
            },
          }),
          dispose: () => Promise.resolve(),
        }
      }
      synthesisStarted()
      return {
        id: SessionId('child-synthesis'),
        localAgent: undefined,
        result: new Promise((resolve) => {
          const abort = (): void => { resolve({ output: [], stopReason: 'aborted' }) }
          if (request.signal.aborted) abort()
          else request.signal.addEventListener('abort', abort, { once: true })
        }),
        dispose: () => Promise.resolve(),
      }
    }, {
      maxParallelShadows: 2,
      conflictSynthesisEnabled: true,
      definitions: {
        'challenge.md': `---
id: challenge
name: Challenge
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
---
Challenge the result.
`,
        'confirm.md': `---
id: confirm
name: Confirm
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
---
Confirm the result.
`,
        'synthesizer.md': `---
id: synthesizer
name: Synthesizer
enabled: true
activation_probability: 0
active_for_models: ['*']
tools: []
---
Resolve the conflict from the two report texts.
`,
      },
    })
    emitToolTurn(harness)
    await started

    harness.ctx.emit('agent/inbox/inserted', {
      agent: harness.agent,
      message: createUserMessage({
        content: [{ type: 'text', text: 'Replace the task while synthesis is running.' }],
        source: { kind: 'user' },
      }),
    })

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs).toHaveLength(2)
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          phase: 'aborted',
          stage: 'relay',
          reasonCode: 'USER_MESSAGE_RECEIVED',
          cancellationSource: 'user-input',
          relayed: false,
        }),
        expect.objectContaining({
          phase: 'aborted',
          stage: 'relay',
          reasonCode: 'USER_MESSAGE_RECEIVED',
          cancellationSource: 'user-input',
          relayed: false,
        }),
      ]))
    })
    expect(harness.deliveries).toHaveLength(0)
  })

  it('fails conflict synthesis open when its definition registry becomes unreadable', async () => {
    let run = 0
    const harness = await setup(() => {
      run += 1
      return {
        id: SessionId(`child-fail-open-${String(run)}`),
        localAgent: undefined,
        result: Promise.resolve({
          output: [],
          stopReason: 'completed',
          structured: {
            status: 'report',
            content: `Original report ${String(run)}.`,
            verdict: run === 1 ? 'challenge' : 'confirm',
            refs: [],
          },
        }),
        dispose: () => Promise.resolve(),
      }
    }, {
      resultBatchWindowMs: 1_000,
      maxParallelShadows: 2,
      conflictSynthesisEnabled: true,
      definitions: {
        'challenge.md': `---
id: challenge
name: Challenge
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
---
Challenge the result.
`,
        'confirm.md': `---
id: confirm
name: Confirm
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
---
Confirm the result.
`,
        'synthesizer.md': `---
id: synthesizer
name: Synthesizer
enabled: true
activation_probability: 0
active_for_models: ['*']
tools: []
---
Resolve the conflict.
`,
      },
    })
    emitToolTurn(harness)
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs).toMatchObject([
        { phase: 'report', relayed: false },
        { phase: 'report', relayed: false },
      ])
    })

    const definitionRoot = join(harness.dshHome, 'shadow-minds')
    await rm(definitionRoot, { recursive: true, force: true })
    await writeFile(definitionRoot, 'not a directory', 'utf8')
    await vi.waitFor(() => { expect(harness.deliveries).toHaveLength(1) }, { timeout: 2_000 })

    expect(JSON.stringify(harness.deliveries[0])).toContain('Original report 1.')
    expect(JSON.stringify(harness.deliveries[0])).toContain('Original report 2.')
    expect(harness.runtime.status(harness.agent)).toMatchObject({
      synthesisFailures: 1,
      lastSynthesisFailure: 'preparation_failed',
    })
    expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs).toMatchObject([
      { phase: 'report', relayed: true },
      { phase: 'report', relayed: true },
    ])
  })

  it('redacts holdout literals from the complete relay framing', async () => {
    const literal = 'PRIVATE_BENCHMARK_NAME'
    const harness = await setup(() => ({
      id: SessionId('child-holdout-relay'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: {
          status: 'report',
          content: 'The report content is already clean.',
          verdict: 'challenge',
          refs: [],
        },
      }),
      dispose: () => Promise.resolve(),
    }), {
      definitions: {
        'reviewer.md': `---
id: reviewer
name: Reviewer ${literal}
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
holdout: true
---
Review the completed turn.
`,
      },
      holdoutKeys: { reviewer: [literal] },
    })
    emitToolTurn(harness)

    await vi.waitFor(() => { expect(harness.deliveries).toHaveLength(1) })
    const relay = JSON.stringify(harness.deliveries[0])
    expect(relay).not.toContain(literal)
    expect(relay).toContain('[redacted holdout]')
  })

  it('rejects unsupported external conditioning before provider start', async () => {
    let starts = 0
    const harness = await setup(() => {
      starts += 1
      throw new Error('provider start must not be called')
    }, {
      definitions: {
        'reviewer.md': `---
id: reviewer
name: Reviewer
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
context: minimal
think_first: true
---
Review the completed turn.
`,
      },
    })
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'failed',
        stage: 'prepare',
        error: { message: expect.stringContaining('contextInheritance, thinkFirst') },
      })
    })
    expect(starts).toBe(0)
    expect(harness.deliveries).toHaveLength(0)
  })

  it('admits the same Shadow again on a later tool-using turn', async () => {
    let run = 0
    const harness = await setup(() => ({
      id: SessionId(`child-report-${String(++run)}`),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'report', content: `Finding ${String(run)}.`, verdict: 'challenge', refs: [] },
      }),
      dispose: () => Promise.resolve(),
    }))
    const first = emitToolTurn(harness, 1)
    await vi.waitFor(() => {
      expect(harness.runtime.status(harness.agent).active).toHaveLength(0)
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'report',
        relayed: true,
      })
    })

    const second = emitToolTurn(harness, 2)
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent).map(cycle => ({
        capturedThroughSeq: cycle.capturedThroughSeq,
        phase: cycle.runs[0]?.phase,
        relayed: cycle.runs[0]?.relayed,
      }))).toEqual([
        { capturedThroughSeq: first, phase: 'report', relayed: true },
        { capturedThroughSeq: second, phase: 'report', relayed: true },
      ])
    })
    expect(harness.deliveries).toHaveLength(2)
  })

  it('keeps silent visible without waking the root agent', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-silent'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'silent', content: '' },
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'silent',
        stage: 'validate',
      })
    })
    expect(harness.deliveries).toHaveLength(0)
  })

  it('classifies provider failure and keeps its diagnostics safe', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-failed'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'error',
        diagnostic: 'provider failed at "C:\\Private Data\\request.json" with token=example-credential-value',
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'failed',
        stage: 'run',
        reasonCode: 'PROVIDER_ERROR',
        providerStopReason: 'error',
        error: { message: 'provider failed at [absolute-path] with [credential]' },
      })
    })
    expect(harness.deliveries).toHaveLength(0)

    const debug = await readFile(
      join(harness.dshHome, 'shadow-minds', 'logs', 'reviewer.jsonl'),
      'utf8',
    )
    expect(debug).not.toContain('Private Data')
    expect(debug).not.toContain('example-credential-value')
    expect(debug).not.toContain('stack')
  })

  it('attributes a user-message cancellation and records its diagnostic timeline', async () => {
    const harness = await setup(request => ({
      id: SessionId('child-aborted'),
      localAgent: undefined,
      result: new Promise((resolve) => {
        const abort = (): void => { resolve({ output: [], stopReason: 'aborted' }) }
        if (request.signal.aborted) abort()
        else request.signal.addEventListener('abort', abort, { once: true })
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'running',
        stage: 'run',
      })
    })

    harness.ctx.emit('agent/inbox/inserted', {
      agent: harness.agent,
      message: createUserMessage({
        content: [{ type: 'text', text: 'Continue with another task.' }],
        source: { kind: 'user' },
      }),
    })

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'aborted',
        stage: 'run',
        reasonCode: 'USER_MESSAGE_RECEIVED',
        cancellationSource: 'user-input',
        providerStopReason: 'aborted',
      })
    })
    expect(harness.deliveries).toHaveLength(0)

    const records = (await readFile(
      join(harness.dshHome, 'shadow-minds', 'logs', 'reviewer.jsonl'),
      'utf8',
    )).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
    expect(records.map(record => record['event'])).toEqual([
      'run-admitted',
      'child-started',
      'run-cancellation-requested',
      'quality-metadata',
      'run-finished',
    ])
    expect(records.at(-1)).toMatchObject({
      phase: 'aborted',
      reasonCode: 'USER_MESSAGE_RECEIVED',
      cancellationSource: 'user-input',
      providerStopReason: 'aborted',
    })
  })
})
