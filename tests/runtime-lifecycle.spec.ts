import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import {
  ToolCallId,
  createMessage,
  createToolResultMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type {
  ResolvedSubagentStartRequest,
  SubagentCapabilities,
  SubagentProvider,
  SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import ShadowMindRuntime, { DEFAULT_SHADOW_ID } from '../src/runtime/index.ts'
import { MemorySettings } from './memory-settings.ts'

const CAPABILITIES: SubagentCapabilities = {
  agentOptions: true,
  outputSchema: true,
  depthLimit: true,
  toolFilter: true,
  persona: true,
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
  const definitions = options.definitions ?? { 'default.md': `---
id: default
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
    resultBatchWindowMs: options.resultBatchWindowMs ?? 0,
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
  const callId = ToolCallId(`call-${String(turn)}`)
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

  it('ensures the default definition exists when the admin catalog is served', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-unused'),
      localAgent: undefined,
      result: Promise.resolve({ output: [], stopReason: 'completed', structured: { status: 'silent', content: '' } }),
      dispose: () => Promise.resolve(),
    }), { definitions: {} })

    const first = await harness.runtime.remoteExportCatalog()
    expect(first.defaultShadowTimeoutSeconds).toBe(600)
    expect(first.definitions.map(item => item.id)).toContain(DEFAULT_SHADOW_ID)
    expect(first.definitions.find(item => item.id === DEFAULT_SHADOW_ID)).toMatchObject({
      activationProbability: 0.7,
      enabled: true,
    })
    expect(await readFile(join(harness.dshHome, 'shadow-minds', `${DEFAULT_SHADOW_ID}.md`), 'utf8'))
      .toContain('activation_probability: 0.7')
    // Idempotent: a second load neither duplicates nor overwrites the file.
    const second = await harness.runtime.remoteExportCatalog()
    expect(second.definitions.filter(item => item.id === DEFAULT_SHADOW_ID)).toHaveLength(1)
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
        'default.md': `---
id: default
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
      holdoutKeys: { default: [literal] },
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
        'default.md': `---
id: default
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

  it('defers a qualifying turn while a review is running and still reviews both (issue #3)', async () => {
    type RunningResult = {
      readonly output: never[]
      readonly stopReason: 'completed'
      readonly structured: { readonly status: 'report'; readonly content: string; readonly verdict: 'challenge'; readonly refs: number[] }
    }
    let resolveFirst!: (value: RunningResult) => void
    const firstResult = new Promise<RunningResult>(resolve => { resolveFirst = resolve })
    let run = 0
    const harness = await setup(() => {
      run += 1
      const id = SessionId(`child-overlap-${String(run)}`)
      if (run === 1) {
        return {
          id,
          localAgent: undefined,
          result: firstResult,
          dispose: () => Promise.resolve(),
        }
      }
      return {
        id,
        localAgent: undefined,
        result: Promise.resolve({
          output: [],
          stopReason: 'completed',
          structured: { status: 'report', content: 'Second finding.', verdict: 'challenge', refs: [] },
        }),
        dispose: () => Promise.resolve(),
      }
    })

    emitToolTurn(harness, 1)
    await vi.waitFor(() => {
      expect(harness.runtime.status(harness.agent).active).toHaveLength(1)
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]?.phase).toBe('running')
    })

    // A second qualifying turn completes while the first review is still running:
    // it must be DEFERRED (queued), not silently dropped.
    emitToolTurn(harness, 2)
    await vi.waitFor(() => { expect(harness.runtime.reviewCycles(harness.agent)).toHaveLength(2) })
    const during = harness.runtime.reviewCycles(harness.agent)
    expect(during[1]?.runs).toEqual([])
    expect(during[1]?.scheduling).toBe(true)
    expect(harness.runtime.status(harness.agent).active).toHaveLength(1)

    // Finish the first review; the deferred turn must then be scheduled and relayed.
    resolveFirst({
      output: [],
      stopReason: 'completed',
      structured: { status: 'report', content: 'First finding.', verdict: 'challenge', refs: [] },
    })
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({ phase: 'report', relayed: true })
      expect(harness.runtime.reviewCycles(harness.agent)[1]?.runs[0]).toMatchObject({ phase: 'report', relayed: true })
    })
    expect(harness.deliveries).toHaveLength(2)
  })

  it('drops deferred turns that span a new user message, per the stale policy (issue #3)', async () => {
    type RunningResult = {
      readonly output: never[]
      readonly stopReason: 'completed'
      readonly structured: { readonly status: 'report'; readonly content: string; readonly verdict: 'challenge'; readonly refs: number[] }
    }
    let resolveFirst!: (value: RunningResult) => void
    const firstResult = new Promise<RunningResult>(resolve => { resolveFirst = resolve })
    let run = 0
    const harness = await setup(() => {
      run += 1
      const id = SessionId(`child-stale-${String(run)}`)
      if (run === 1) return { id, localAgent: undefined, result: firstResult, dispose: () => Promise.resolve() }
      return {
        id,
        localAgent: undefined,
        result: Promise.resolve({
          output: [],
          stopReason: 'completed',
          structured: { status: 'report', content: 'Second.', verdict: 'challenge', refs: [] },
        }),
        dispose: () => Promise.resolve(),
      }
    })

    emitToolTurn(harness, 1)
    await vi.waitFor(() => { expect(harness.runtime.status(harness.agent).active).toHaveLength(1) })
    emitToolTurn(harness, 2)
    await vi.waitFor(() => { expect(harness.runtime.reviewCycles(harness.agent)).toHaveLength(2) })
    // The second turn was deferred (no run yet, still scheduling).
    expect(harness.runtime.reviewCycles(harness.agent)[1]?.runs).toEqual([])

    // A new user message invalidates the review epoch: the deferred turn is dropped
    // as stale and the running review is cancelled.
    harness.ctx.emit('agent/inbox/inserted', {
      agent: harness.agent,
      message: createUserMessage({
        content: [{ type: 'text', text: 'New task.' }],
        source: { kind: 'user' },
      }),
    })
    resolveFirst({
      output: [],
      stopReason: 'completed',
      structured: { status: 'report', content: 'First.', verdict: 'challenge', refs: [] },
    })
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'aborted',
        reasonCode: 'USER_MESSAGE_RECEIVED',
      })
    })
    expect(harness.runtime.reviewCycles(harness.agent)[1]?.runs).toEqual([])
    expect(harness.runtime.reviewCycles(harness.agent)[1]?.scheduling).toBe(false)
    expect(harness.deliveries).toHaveLength(0)
    expect(harness.runtime.status(harness.agent).active).toHaveLength(0)
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

  it('settles silent with an explanatory body instead of failing validation', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-silent-body'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'silent', content: 'Nothing actionable after reviewing the turn.' },
      }),
      dispose: () => Promise.resolve(),
    }))
    const warn = vi.spyOn(harness.ctx.logger, 'warn')
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'silent',
        stage: 'validate',
      })
    })
    expect(harness.deliveries).toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(
      'dsh-shadow-mind: shadow %s returned %s with a non-empty content body; the body is not relayed and was discarded (run %s)',
      'default',
      'silent',
      expect.any(String),
    )

    const records = (await readFile(
      join(harness.dshHome, 'shadow-minds', 'logs', 'default.jsonl'),
      'utf8',
    )).trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
    const discarded = records.find(record => record['event'] === 'non-report-body-discarded')
    expect(discarded).toMatchObject({
      status: 'silent',
      discardedBodyChars: 'Nothing actionable after reviewing the turn.'.length,
    })
    expect(discarded?.['discardedBodyHash']).toBe('d6ed8049f11cbbcbe38047ebbd5f60888a11d87351b1984ba66b1b0ae0c48d10')
    // The body text itself must never be persisted to the debug log.
    expect(JSON.stringify(records)).not.toContain('Nothing actionable after reviewing the turn.')
  })

  it('settles not_relevant with an explanatory body instead of failing validation', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-not-relevant-body'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'not_relevant', content: 'Outside this Shadow specialty.' },
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'not_relevant',
        stage: 'validate',
      })
    })
    expect(harness.deliveries).toHaveLength(0)
  })

  it('does not warn when a non-report status carries an empty body', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-silent-empty'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'silent', content: '' },
      }),
      dispose: () => Promise.resolve(),
    }))
    const warn = vi.spyOn(harness.ctx.logger, 'warn')
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'silent',
        stage: 'validate',
      })
    })
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('non-empty content body'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('rejects report-only fields carried on a non-report status', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-silent-verdict'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'silent', content: '', verdict: 'confirm' },
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'failed',
        stage: 'validate',
        reasonCode: 'INVALID_STRUCTURED_OUTPUT',
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
      join(harness.dshHome, 'shadow-minds', 'logs', 'default.jsonl'),
      'utf8',
    )
    expect(debug).not.toContain('Private Data')
    expect(debug).not.toContain('example-credential-value')
    expect(debug).not.toContain('stack')
  })

  it('classifies a completed turn with missing structured output as STRUCTURED_OUTPUT_MISSING', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-no-structure'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [{ type: 'text', text: 'Investigation complete; the report follows in text.' }],
        diagnostic: 'Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.',
        stopReason: 'no-structured-output',
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'failed',
        stage: 'run',
        reasonCode: 'STRUCTURED_OUTPUT_MISSING',
        providerStopReason: 'no-structured-output',
        error: {
          message: 'Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.',
        },
      })
    })
    expect(harness.deliveries).toHaveLength(0)
  })

  it('records child tool calls and INVALID_ARGS counts in the debug quality-metadata', async () => {
    const readCall = ToolCallId('read-1')
    const structuredCall = ToolCallId('structured-1')
    const orphanCall = ToolCallId('orphan-1')
    const events = [
      {
        type: 'tool/call', seq: 1, time: 1,
        data: { turn: 1, step: 1, callId: readCall, name: 'read', arguments: '{}' },
      },
      {
        type: 'tool/result', seq: 2, time: 2,
        data: {
          turn: 1, step: 1,
          message: createToolResultMessage({
            callId: readCall,
            content: [{ type: 'text', text: 'file contents' }],
            isError: false,
          }),
        },
      },
      {
        type: 'tool/call', seq: 3, time: 3,
        data: {
          turn: 1, step: 2,
          callId: structuredCall,
          name: 'structured_output',
          arguments: '{"status":"report"}',
        },
      },
      {
        type: 'tool/result', seq: 4, time: 4,
        data: {
          turn: 1, step: 2,
          message: createToolResultMessage({
            callId: structuredCall,
            content: [{ type: 'text', text: 'Error: invalid arguments: refs out of window' }],
            isError: true,
          }),
          error: { name: 'ToolArgsError', code: 'INVALID_ARGS' },
        },
      },
      {
        type: 'tool/result', seq: 5, time: 5,
        data: {
          turn: 1, step: 3,
          message: createToolResultMessage({
            callId: orphanCall,
            content: [{ type: 'text', text: 'Error: invalid arguments: orphaned retry' }],
            isError: true,
          }),
          error: { name: 'ToolArgsError', code: 'INVALID_ARGS' },
        },
      },
    ]
    const harness = await setup(() => ({
      id: SessionId('child-tool-telemetry'),
      localAgent: { session: { events } } as unknown as Agent,
      result: Promise.resolve({
        output: [],
        diagnostic: 'Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.',
        stopReason: 'no-structured-output',
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'failed',
        reasonCode: 'STRUCTURED_OUTPUT_MISSING',
      })
    })

    const debug = await readFile(join(harness.dshHome, 'shadow-minds', 'logs', 'default.jsonl'), 'utf8')
    const metadata = debug
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line) as Record<string, unknown>)
      .find(record => record.event === 'quality-metadata')
    expect(metadata).toBeDefined()
    expect(metadata?.tools).toEqual({
      calls: 2,
      byName: { read: 1, structured_output: 1 },
      invalidArgs: 2,
      invalidArgsByTool: { structured_output: 1, '(unpaired)': 1 },
    })
    // Arguments and result text never reach the debug log.
    expect(debug).not.toContain('refs out of window')
    expect(debug).not.toContain('orphaned retry')
    expect(debug).not.toContain('"arguments"')
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
      join(harness.dshHome, 'shadow-minds', 'logs', 'default.jsonl'),
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

  it('manually retries a failed run and admits a second launch that can succeed', async () => {
    let attempt = 0
    const harness = await setup(() => {
      attempt += 1
      const id = SessionId(`child-retry-${String(attempt)}`)
      if (attempt === 1) {
        return {
          id,
          localAgent: undefined,
          result: Promise.resolve({ output: [], stopReason: 'error' }),
          dispose: () => Promise.resolve(),
        }
      }
      return {
        id,
        localAgent: undefined,
        result: Promise.resolve({
          output: [],
          stopReason: 'completed',
          structured: {
            status: 'report',
            content: 'Recovered finding after the manual retry.',
            verdict: 'challenge',
            refs: [],
          },
        }),
        dispose: () => Promise.resolve(),
      }
    })
    emitToolTurn(harness)
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'failed',
        stage: 'run',
        reasonCode: 'PROVIDER_ERROR',
      })
    })
    const failed = harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]
    if (failed === undefined) throw new Error('failed run was not recorded')

    const status = await harness.runtime.retry(harness.agent, failed.runId)
    expect(status.totalRuns).toBe(2)

    await vi.waitFor(() => {
      const cycle = harness.runtime.reviewCycles(harness.agent)[0]
      expect(cycle?.runs).toHaveLength(2)
      expect(cycle?.runs[0]).toMatchObject({ runId: failed.runId, phase: 'failed' })
      expect(cycle?.runs[1]).toMatchObject({ phase: 'report', relayed: true })
    })
    expect(harness.deliveries).toHaveLength(1)
  })

  it('rejects retrying a non-terminal or unknown run', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-report-retry-guard'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'report', content: 'Stable finding.', verdict: 'confirm', refs: [] },
      }),
      dispose: () => Promise.resolve(),
    }))
    emitToolTurn(harness)
    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({
        phase: 'report',
        relayed: true,
      })
    })
    const reported = harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]
    if (reported === undefined) throw new Error('report run was not recorded')

    await expect(harness.runtime.retry(harness.agent, reported.runId)).rejects.toThrow(
      'is report; only failed or aborted runs can be retried',
    )
    await expect(harness.runtime.retry(harness.agent, 'run-unknown')).rejects.toThrow(
      'was not found for this session',
    )
    expect(harness.runtime.status(harness.agent).totalRuns).toBe(1)
    expect(harness.deliveries).toHaveLength(1)
  })

  it('retries the most recent failed run without a run id and rejects when none exists', async () => {
    let attempt = 0
    const harness = await setup(() => {
      attempt += 1
      return {
        id: SessionId(`child-latest-retry-${String(attempt)}`),
        localAgent: undefined,
        result: Promise.resolve({ output: [], stopReason: 'error' }),
        dispose: () => Promise.resolve(),
      }
    })
    emitToolTurn(harness, 1)
    emitToolTurn(harness, 2)

    await vi.waitFor(() => {
      const runs = harness.runtime.reviewCycles(harness.agent).flatMap(cycle => cycle.runs)
      expect(runs).toHaveLength(2)
      expect(runs.every(run => run.phase === 'failed')).toBe(true)
    })
    expect(harness.runtime.latestFailedRun(harness.agent)?.runId)
      .toBe(harness.runtime.reviewCycles(harness.agent)[1]?.runs[0]?.runId)

    const status = await harness.runtime.retryLatest(harness.agent)
    expect(status.totalRuns).toBe(3)

    // The retried run joins the later cycle that owned the latest failure.
    await vi.waitFor(() => {
      const cycles = harness.runtime.reviewCycles(harness.agent)
      expect(cycles[0]?.runs).toHaveLength(1)
      expect(cycles[1]?.runs).toHaveLength(2)
      expect(cycles[1]?.runs.every(run => run.phase === 'failed')).toBe(true)
    })

    // Every run is still failed, so the newest retry remains the latest failure.
    const cycles = harness.runtime.reviewCycles(harness.agent)
    const latest = cycles[1]?.runs[1]
    if (latest === undefined) throw new Error('retried run was not recorded')
    expect(harness.runtime.latestFailedRun(harness.agent)?.runId).toBe(latest.runId)
  })

  it('rejects retryLatest while no failed or aborted run exists', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-no-failure'),
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
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({ phase: 'silent' })
    })
    await expect(harness.runtime.retryLatest(harness.agent)).rejects.toThrow(
      'this session has no failed or aborted Shadow run to retry',
    )
    expect(harness.runtime.status(harness.agent).totalRuns).toBe(1)
  })

  it('forces a fresh review with reviewNow and gates sessions that already admitted runs', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-manual-review'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'report', content: 'Manual review finding.', verdict: 'gap', refs: [] },
      }),
      dispose: () => Promise.resolve(),
    }))
    // Seed content without completing a tool-using turn, so automatic
    // scheduling has no reason to admit a run on its own.
    const session = harness.agent.session
    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'Explain the plan.' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    const turnEnd = session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    const status = await harness.runtime.reviewNow(harness.agent)
    expect(status.totalRuns).toBe(1)
    expect(status.active).toHaveLength(1)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]).toMatchObject({
        capturedThroughSeq: turnEnd.seq,
        runs: [{ phase: 'report', stage: 'relay' }],
      })
    })
    expect(harness.deliveries).toHaveLength(1)

    await expect(harness.runtime.reviewNow(harness.agent)).rejects.toThrow(
      'this session has already admitted 1 Shadow run(s); use /shadow retry to rerun a failed review',
    )
    expect(harness.runtime.status(harness.agent).totalRuns).toBe(1)
  })

  it('forces a review even when the default definition is disabled', async () => {
    const harness = await setup(() => ({
      id: SessionId('child-disabled-manual'),
      localAgent: undefined,
      result: Promise.resolve({
        output: [],
        stopReason: 'completed',
        structured: { status: 'silent', content: '' },
      }),
      dispose: () => Promise.resolve(),
    }), {
      definitions: {
        'default.md': `---
id: default
name: Reviewer
enabled: false
activation_probability: 0
tools: []
---
Review the completed turn.
`,
      },
    })
    harness.agent.session.append('turn/start', { turn: 1 })
    harness.agent.session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'Inspect the project.' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    harness.agent.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

    const status = await harness.runtime.reviewNow(harness.agent)
    expect(status.totalRuns).toBe(1)

    await vi.waitFor(() => {
      expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs[0]).toMatchObject({ phase: 'silent' })
    })
    expect(harness.deliveries).toHaveLength(0)
  })

  it('never schedules legacy definitions when the default is disabled', async () => {
    const harness = await setup(() => {
      throw new Error('legacy definitions must never launch a Shadow')
    }, {
      definitions: {
        'default.md': `---
id: default
name: Default
enabled: false
activation_probability: 1
tools: []
---
Review the completed turn.
`,
        'legacy.md': `---
id: legacy
name: Legacy
enabled: true
activation_probability: 1
active_for_models: ['*']
tools: []
---
Legacy review.
`,
      },
    })
    emitToolTurn(harness)
    // Give any (incorrect) schedule a chance to surface before asserting.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(harness.runtime.status(harness.agent)).toMatchObject({ totalRuns: 0, active: [] })
    expect(harness.runtime.reviewCycles(harness.agent)[0]?.runs ?? []).toEqual([])
    expect(harness.deliveries).toHaveLength(0)
  })
})
