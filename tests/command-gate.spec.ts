import { describe, expect, it } from 'vitest'
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
      const result = await execute(ctx, agent, 'Get-Process | Select-Object Name')
      expect(result.isError).toBe(false)
      expect(gate.statsFor(agent)).toMatchObject({ allows: 1, denies: 0, judgeRuns: 0 })
    } finally {
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

  it('starts with empty counters and resets its cache', () => {
    expect(emptyCommandGateStats()).toEqual({ denies: 0, allows: 0, judgeRuns: 0, judgeFailures: 0 })
  })
})
