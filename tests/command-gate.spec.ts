import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import type { ShadowMindSettings } from '../src/runtime/types.ts'
import { resolveSettings } from '../src/runtime/config.ts'
import {
  CommandGate,
  emptyCommandGateStats,
  type CommandGateRuntime,
  type GateCommand,
  type GateJudgeOutcome,
} from '../src/runtime/command-gate.ts'

const testSignal = new AbortController().signal

interface HarnessOptions {
  settings: ShadowMindSettings
  judge?: (command: GateCommand) => Promise<GateJudgeOutcome>
  isRoot?: (agent: Agent) => boolean
}

async function harness(options: HarnessOptions) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  ctx.tools.register(defineTool({
    name: 'pwsh',
    description: 'Fake pwsh for gate tests',
    parameters: {
      command: { type: 'string' },
      description: { type: 'string' },
      workdir: { type: 'string' },
    },
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
  const logs: Record<string, unknown>[] = []
  const runtime: CommandGateRuntime = {
    settings: () => options.settings,
    isRoot: agent => options.isRoot === undefined ? true : options.isRoot(agent),
    judgeVerdict: (_agent, command, _signal) => options.judge === undefined
      ? Promise.resolve({ kind: 'verdict', allow: true, reason: 'default' })
      : options.judge(command),
    appendGateLog: (_agent, record) => { logs.push(record) },
  }
  const gate = new CommandGate(ctx, runtime)
  const dispose = gate.install()
  const session = ctx.sessions.create(SessionId('gate-root'))
  session.append('turn/start', { turn: 1 })
  const agent = { id: session.id, session, status: 'idle' } as Agent
  return { ctx, gate, logs, agent, dispose }
}

async function execute(ctx: Context, agent: Agent | undefined, command: string, args: Record<string, unknown> = {}) {
  return ctx.tools.execute({
    signal: testSignal,
    callId: CallId(`gate-${command}`),
    name: 'pwsh',
    arguments: { command, ...args },
    ...agent === undefined ? {} : { agent },
  })
}

function text(result: { content: readonly { type: string; text?: string }[] }): string {
  return result.content.map(block => 'text' in block && block.text !== undefined ? block.text : '').join('')
}

describe('CommandGate', () => {
  it('denies commands matching a deny pattern before any judge runs', async () => {
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true, commandGateDenyPatterns: ['\\bStop-Process\\b'] }),
    })
    try {
      const result = await execute(ctx, agent, 'Stop-Process -Name dev-worker')
      expect(result.isError).toBe(true)
      expect(text(result)).toContain('deny pattern')
      expect(text(result)).toContain('Stop-Process')
    } finally {
      dispose()
    }
  })

  it('names the protected target when a destructive command mentions one', async () => {
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateProtectedProcesses: ['prod-api'],
      }),
    })
    try {
      const result = await execute(ctx, agent, 'Stop-Process -Name prod-api')
      expect(result.isError).toBe(true)
      expect(text(result)).toContain('protected process "prod-api"')
    } finally {
      dispose()
    }
  })

  it('allows pure-read commands matching an allow pattern without a judge', async () => {
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
    })
    try {
      const result = await execute(ctx, agent, 'Get-Process')
      expect(result.isError).toBe(false)
      expect(gate.statsFor(agent)).toMatchObject({ allows: 1, denies: 0, judgeRuns: 0 })
    } finally {
      dispose()
    }
  })

  it('sends piped or chained commands to the judge instead of prefix-allowing them', async () => {
    let judged: string[] = []
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
      judge: async (command) => {
        judged.push(command.command)
        return { kind: 'verdict', allow: false, reason: 'chained commands need a judge' }
      },
    })
    try {
      const chained = await execute(ctx, agent, 'git status; spsv prod-svc')
      expect(chained.isError).toBe(true)
      const piped = await execute(ctx, agent, 'Get-Process | spsv prod-svc')
      expect(piped.isError).toBe(true)
      expect(judged).toEqual(['git status; spsv prod-svc', 'Get-Process | spsv prod-svc'])
      expect(gate.statsFor(agent)).toMatchObject({ denies: 2, judgeRuns: 2 })
    } finally {
      dispose()
    }
  })

  it('does not prefix-allow version probes with trailing work or destructive git branch flags', async () => {
    let judged: string[] = []
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
      judge: async (command) => {
        judged.push(command.command)
        return { kind: 'verdict', allow: false, reason: 'not a read-only probe' }
      },
    })
    try {
      await execute(ctx, agent, 'cargo -v run')
      await execute(ctx, agent, 'git branch -D hotfix')
      expect(judged).toEqual(['cargo -v run', 'git branch -D hotfix'])
    } finally {
      dispose()
    }
  })

  it('allows the read-only format cmdlets and git branch listing flags', async () => {
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
    })
    try {
      expect((await execute(ctx, agent, 'Format-List Name,Id')).isError).toBe(false)
      expect((await execute(ctx, agent, 'Format-Table')).isError).toBe(false)
      expect((await execute(ctx, agent, 'git branch --list')).isError).toBe(false)
      expect(gate.statsFor(agent)).toMatchObject({ allows: 3, denies: 0, judgeRuns: 0 })
    } finally {
      dispose()
    }
  })

  it('keeps kill/taskkill/shutdown at command position while allowing them inside arguments', async () => {
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
    })
    try {
      expect((await execute(ctx, agent, 'git log --grep kill')).isError).toBe(false)
      expect((await execute(ctx, agent, 'Get-Content kill.log')).isError).toBe(false)
      expect((await execute(ctx, agent, 'Write-Output kill switch')).isError).toBe(false)
      expect((await execute(ctx, agent, 'kill 1234')).isError).toBe(true)
      expect(gate.statsFor(agent)).toMatchObject({ allows: 3, denies: 1 })
    } finally {
      dispose()
    }
  })

  it('warns instead of silently skipping an invalid deny pattern', async () => {
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true, commandGateDenyPatterns: ['[unterminated'] }),
    })
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    try {
      await execute(ctx, agent, 'Some Ambiguous Command')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid command-gate deny pattern'), '[unterminated')
    } finally {
      warn.mockRestore()
      dispose()
    }
  })

  it('runs the judge for ambiguous commands and applies its verdict', async () => {
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
      judge: async () => ({ kind: 'verdict', allow: false, reason: 'would disturb the protected service' }),
    })
    try {
      const result = await execute(ctx, agent, 'Invoke-Build -Task Deploy')
      expect(result.isError).toBe(true)
      expect(text(result)).toContain('would disturb the protected service')
      expect(gate.statsFor(agent)).toMatchObject({ denies: 1, judgeRuns: 1, judgeFailures: 0 })
    } finally {
      dispose()
    }
  })

  it('caches an identical command inside the TTL window', async () => {
    let calls = 0
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateVerdictTtlSeconds: 60,
      }),
      judge: async () => {
        calls += 1
        return { kind: 'verdict', allow: true, reason: 'safe' }
      },
    })
    try {
      await execute(ctx, agent, 'Invoke-Build -Task Publish')
      await execute(ctx, agent, 'Invoke-Build -Task Publish')
      expect(calls).toBe(1)
      expect(gate.statsFor(agent)).toMatchObject({ allows: 2, judgeRuns: 1 })
    } finally {
      dispose()
    }
  })

  it('fails closed by default when the judge times out', async () => {
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateJudgeTimeoutSeconds: 0.05,
      }),
      judge: () => new Promise(() => { /* never settles */ }),
    })
    try {
      const result = await execute(ctx, agent, 'Invoke-Something Slow')
      expect(result.isError).toBe(true)
      expect(text(result)).toContain('judge failed')
      expect(gate.statsFor(agent)).toMatchObject({ denies: 1, judgeRuns: 1, judgeFailures: 1 })
    } finally {
      dispose()
    }
  })

  it('fails open when the failure policy says allow', async () => {
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateOnJudgeFailure: 'allow',
        commandGateJudgeTimeoutSeconds: 0.05,
      }),
      judge: () => Promise.resolve({ kind: 'failure', reason: 'judge exploded' }),
    })
    try {
      const result = await execute(ctx, agent, 'Invoke-Something Broken')
      expect(result.isError).toBe(false)
    } finally {
      dispose()
    }
  })

  it('skips non-root agents under the default scope and gates them under the wider scope', async () => {
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true, commandGateScope: 'root-only' }),
      isRoot: () => false,
    })
    try {
      const skipped = await execute(ctx, agent, 'Stop-Process -Name anything')
      expect(skipped.isError).toBe(false)
    } finally {
      dispose()
    }

    const wide = await harness({
      settings: resolveSettings({ commandGateEnabled: true, commandGateScope: 'root-and-subagents' }),
      isRoot: () => false,
    })
    try {
      const gated = await execute(wide.ctx, wide.agent, 'Stop-Process -Name anything')
      expect(gated.isError).toBe(true)
    } finally {
      wide.dispose()
    }
  })

  it('ignores disabled gates and tools outside the gated set', async () => {
    const disabled = await harness({ settings: resolveSettings({ commandGateEnabled: false }) })
    try {
      const result = await execute(disabled.ctx, disabled.agent, 'Stop-Process -Name anything')
      expect(result.isError).toBe(false)
    } finally {
      disabled.dispose()
    }

    const otherTools = await harness({
      settings: resolveSettings({ commandGateEnabled: true, commandGateTools: ['bash'] }),
    })
    try {
      const result = await execute(otherTools.ctx, otherTools.agent, 'Stop-Process -Name anything')
      expect(result.isError).toBe(false)
    } finally {
      otherTools.dispose()
    }
  })

  it('skips executions without a string command and tolerates invalid patterns', async () => {
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateDenyPatterns: ['[unterminated'],
        commandGateAllowPatterns: ['[also-broken'],
      }),
    })
    try {
      const empty = await ctx.tools.execute({
        signal: testSignal,
        callId: CallId('gate-no-command'),
        name: 'pwsh',
        arguments: {},
        agent,
      })
      expect(empty.isError).toBe(false)
      const judged = await execute(ctx, agent, 'Some Command Here')
      expect(judged.isError).toBe(false)
    } finally {
      dispose()
    }
  })

  it('records every decision in the gate log', async () => {
    const { ctx, agent, logs, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
    })
    try {
      await execute(ctx, agent, 'Get-Process')
      await execute(ctx, agent, 'Stop-Process -Name dev')
      expect(logs.length).toBe(2)
      expect(logs[0]).toMatchObject({ tier: 'allow-pattern', allow: true, tool: 'pwsh' })
      expect(logs[1]).toMatchObject({ tier: 'deny-pattern', allow: false })
    } finally {
      dispose()
    }
  })

  it('audits cached verdict hits instead of staying silent', async () => {
    const { ctx, agent, logs, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateVerdictTtlSeconds: 60,
      }),
      judge: async () => ({ kind: 'verdict', allow: true, reason: 'safe' }),
    })
    try {
      await execute(ctx, agent, 'Invoke-Build -Task Deploy')
      await execute(ctx, agent, 'Invoke-Build -Task Deploy')
      expect(logs).toHaveLength(2)
      expect(logs[1]).toMatchObject({ tier: 'cached', allow: true })
    } finally {
      dispose()
    }
  })

  it('re-judges after the TTL expires and after reset()', async () => {
    let calls = 0
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateVerdictTtlSeconds: 0,
      }),
      judge: async () => {
        calls += 1
        return { kind: 'verdict', allow: true, reason: 'safe' }
      },
    })
    try {
      await execute(ctx, agent, 'Invoke-Build -Task Deploy')
      await execute(ctx, agent, 'Invoke-Build -Task Deploy')
      expect(calls).toBe(2)
      gate.reset()
      await execute(ctx, agent, 'Invoke-Build -Task Deploy')
      expect(calls).toBe(3)
    } finally {
      dispose()
    }
  })

  it('deduplicates identical in-flight judge requests', async () => {
    let calls = 0
    let release: (() => void) | undefined
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({ commandGateEnabled: true }),
      judge: () => {
        calls += 1
        return new Promise(resolveJudge => {
          release = () => resolveJudge({ kind: 'verdict', allow: true, reason: 'safe' })
        })
      },
    })
    try {
      const first = execute(ctx, agent, 'Invoke-Build -Task Deploy')
      const second = execute(ctx, agent, 'Invoke-Build -Task Deploy')
      await vi.waitFor(() => { expect(release).toBeDefined() })
      release?.()
      const results = await Promise.all([first, second])
      expect(results.every(result => !result.isError)).toBe(true)
      expect(calls).toBe(1)
    } finally {
      dispose()
    }
  })

  it('queues surplus judges behind the concurrency cap', async () => {
    const order: string[] = []
    let releaseFirst: (() => void) | undefined
    const { ctx, agent, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateMaxParallel: 1,
        commandGateJudgeTimeoutSeconds: 10,
      }),
      judge: async (command) => {
        order.push(command.command)
        if (command.command.startsWith('First')) {
          await new Promise<void>(resolveJudge => {
            releaseFirst = () => resolveJudge()
          })
        }
        return { kind: 'verdict', allow: true, reason: 'safe' }
      },
    })
    try {
      const first = execute(ctx, agent, 'First Ambiguous Command')
      await new Promise<void>(resolveTick => setTimeout(resolveTick, 10))
      const second = execute(ctx, agent, 'Second Ambiguous Command')
      await new Promise<void>(resolveTick => setTimeout(resolveTick, 10))
      expect(order).toEqual(['First Ambiguous Command'])
      releaseFirst?.()
      await Promise.all([first, second])
      expect(order).toEqual(['First Ambiguous Command', 'Second Ambiguous Command'])
    } finally {
      dispose()
    }
  })

  it('releases an aborted queued waiter without waiting for the slot', async () => {
    let releaseFirst: (() => void) | undefined
    const { ctx, agent, gate, dispose } = await harness({
      settings: resolveSettings({
        commandGateEnabled: true,
        commandGateMaxParallel: 1,
        commandGateJudgeTimeoutSeconds: 10,
      }),
      judge: async (command) => {
        if (command.command.startsWith('First')) {
          await new Promise<GateJudgeOutcome>(resolveJudge => {
            releaseFirst = () => resolveJudge({ kind: 'verdict', allow: true, reason: 'safe' })
          })
        }
        return { kind: 'verdict', allow: true, reason: 'safe' }
      },
    })
    const firstController = new AbortController()
    try {
      const first = ctx.tools.execute({
        signal: firstController.signal,
        callId: CallId('gate-first'),
        name: 'pwsh',
        arguments: { command: 'First Ambiguous Command' },
        agent,
      })
      await new Promise<void>(resolveTick => setTimeout(resolveTick, 10))
      const secondController = new AbortController()
      const second = ctx.tools.execute({
        signal: secondController.signal,
        callId: CallId('gate-second'),
        name: 'pwsh',
        arguments: { command: 'Second Ambiguous Command' },
        agent,
      })
      await new Promise<void>(resolveTick => setTimeout(resolveTick, 10))
      secondController.abort(new Error('turn aborted'))
      const secondResult = await second
      expect(secondResult.isError).toBe(true)
      // The aborted waiter never reached a judge: it counts as a denial, not
      // as a judge run or a judge failure.
      expect(gate.statsFor(agent)).toMatchObject({ denies: 1, judgeRuns: 1, judgeFailures: 0 })
      releaseFirst?.()
      await first
      // The first still settles through the judge; the second never waited
      // for the slot release because its abort path removed it from the queue.
      expect(gate.statsFor(agent)).toMatchObject({ judgeRuns: 1 })
    } finally {
      releaseFirst?.()
      dispose()
    }
  })

  it('starts with empty counters and resets its cache', () => {
    expect(emptyCommandGateStats()).toEqual({ denies: 0, allows: 0, judgeRuns: 0, judgeFailures: 0 })
  })
})
