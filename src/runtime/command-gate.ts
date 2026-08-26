/**
 * Root-agent command gate: deterministic deny/allow tiers plus an LLM gate
 * judge that runs inside `tools/pre-execute`, so the root agent's turn blocks
 * until a verdict admits or refuses one pwsh-style command. The primary
 * scenario is preventing the root agent from killing production services
 * while it edits a project.
 * @module @whutzefengxie-ops/dsh-shadow-mind/command-gate
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import type { ShadowMindSettings } from './types.ts'

/** Structured verdict schema the gate judge must answer with. */
export const GATE_OUTPUT_SCHEMA: ObjectJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: ['allow', 'deny'] },
    reason: { type: 'string' },
  },
  required: ['decision', 'reason'],
}

/** The command under review, extracted from the pending tool execution. */
export interface GateCommand {
  /** Exact command string the tool would execute. */
  readonly command: string
  /** Tool-supplied human description, when present. */
  readonly description?: string
  /** Tool-supplied working directory, when present. */
  readonly workdir?: string
  /** Intercepted tool name. */
  readonly toolName: string
}

/** One gate judge settlement. */
export type GateJudgeOutcome =
  | { readonly kind: 'verdict'; readonly allow: boolean; readonly reason: string }
  | { readonly kind: 'failure'; readonly reason: string }

/** Decided tier of one verdict, kept for diagnostics. */
export type GateTier = 'deny-pattern' | 'allow-pattern' | 'judge' | 'cached' | 'failure'

/** One settled allow/deny verdict with its provenance. */
export interface GateVerdict {
  readonly allow: boolean
  readonly reason: string
  readonly tier: GateTier
}

/** Per-root lifetime counters exposed through {@link ShadowMindStatus}. */
export interface CommandGateStats {
  denies: number
  allows: number
  judgeRuns: number
  judgeFailures: number
}

/** Host surface the gate needs from the Shadow Mind runtime. */
export interface CommandGateRuntime {
  /** Live resolved settings snapshot. */
  settings(): ShadowMindSettings
  /** Whether an agent is a top-level root rather than a subagent child. */
  isRoot(agent: Agent): boolean
  /** Ask the gate judge to settle one command; failures never throw. */
  judgeVerdict(agent: Agent, command: GateCommand, signal: AbortSignal): Promise<GateJudgeOutcome>
  /** Append one diagnostic record to the plugin-owned gate log. */
  appendGateLog(agent: Agent, record: Record<string, unknown>): void
}

/** Empty counters for a fresh root. */
export function emptyCommandGateStats(): CommandGateStats {
  return { denies: 0, allows: 0, judgeRuns: 0, judgeFailures: 0 }
}

/**
 * Deterministic tiers answer instantly; only the middle band reaches the
 * judge. Judge verdicts are cached per (agent, command) for the configured
 * TTL and deduplicated while in flight, and judge concurrency is capped so a
 * burst of ambiguous commands cannot spawn unbounded children.
 */
export class CommandGate {
  private readonly stats = new Map<Agent, CommandGateStats>()
  private readonly cache = new Map<string, { verdict: GateVerdict; until: number }>()
  private readonly inFlight = new Map<string, Promise<GateVerdict>>()
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly ctx: Context, private readonly runtime: CommandGateRuntime) {}

  /** Register the pre-execute listener; returns its disposer. */
  install(): () => void {
    const disposer = this.ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
      const command = this.interested(exec)
      if (command === undefined) return next()
      const verdict = await this.decide(exec, command)
      if (verdict.allow) return next()
      return { kind: 'deny', reason: verdict.reason }
    })
    const disposeStats = this.ctx.on('agent/disposed', ({ agent }) => {
      this.stats.delete(agent)
    })
    return () => {
      disposer()
      disposeStats()
    }
  }

  /** Per-root lifetime counters. */
  statsFor(agent: Agent): CommandGateStats {
    let stats = this.stats.get(agent)
    if (stats === undefined) {
      stats = emptyCommandGateStats()
      this.stats.set(agent, stats)
    }
    return stats
  }

  /** Drop every cached verdict; settings or user-input boundaries call this. */
  reset(): void {
    this.cache.clear()
  }

  /** Whether this execution enters the gate, with its extracted command. */
  private interested(exec: ToolExecution): GateCommand | undefined {
    const settings = this.runtime.settings()
    if (!settings.commandGateEnabled || exec.agent === undefined) return undefined
    if (!settings.commandGateTools.includes(exec.name)) return undefined
    if (settings.commandGateScope === 'root-only' && !this.runtime.isRoot(exec.agent)) return undefined
    const args = exec.arguments as { command?: unknown; description?: unknown; workdir?: unknown }
    if (typeof args.command !== 'string' || args.command.trim() === '') return undefined
    return {
      command: args.command,
      ...typeof args.description === 'string' && args.description !== '' ? { description: args.description } : {},
      ...typeof args.workdir === 'string' && args.workdir !== '' ? { workdir: args.workdir } : {},
      toolName: exec.name,
    }
  }

  /** Run the tiered pipeline for one intercepted command. */
  private async decide(exec: ToolExecution, command: GateCommand): Promise<GateVerdict> {
    const settings = this.runtime.settings()
    const agent = exec.agent as Agent
    const stats = this.statsFor(agent)
    const deny = this.denyVerdict(settings, command)
    if (deny !== undefined) {
      this.log(agent, exec, command, deny)
      stats.denies += 1
      return deny
    }
    if (this.allows(settings, command)) {
      const verdict: GateVerdict = { allow: true, reason: 'matches a command-gate allow pattern', tier: 'allow-pattern' }
      this.log(agent, exec, command, verdict)
      stats.allows += 1
      return verdict
    }
    const key = `${String(agent.id)}\u0000${command.command}`
    const cached = this.cache.get(key)
    if (cached !== undefined && cached.until > Date.now()) {
      const verdict: GateVerdict = { ...cached.verdict, tier: 'cached' }
      if (verdict.allow) stats.allows += 1
      else stats.denies += 1
      return verdict
    }
    this.cache.delete(key)
    const pending = this.inFlight.get(key)
    if (pending !== undefined) {
      const verdict = await pending
      if (verdict.allow) stats.allows += 1
      else stats.denies += 1
      return verdict
    }
    const started = (async (): Promise<GateVerdict> => {
      try {
        await this.acquire(exec.signal)
      } catch {
        // The root turn aborted while this command queued for the judge; the
        // registry's caller-cancellation path settles the call itself.
        return { allow: false, reason: 'command gate judge wait aborted', tier: 'failure' }
      }
      try {
        stats.judgeRuns += 1
        const outcome = await Promise.race([
          this.runtime.judgeVerdict(agent, command, exec.signal),
          this.timeoutFailure(settings, exec.signal),
        ])
        if (outcome.kind === 'verdict') {
          const verdict: GateVerdict = {
            allow: outcome.allow,
            reason: outcome.reason,
            tier: 'judge',
          }
          this.cache.set(key, { verdict, until: Date.now() + settings.commandGateVerdictTtlSeconds * 1_000 })
          this.log(agent, exec, command, verdict)
          return verdict
        }
        stats.judgeFailures += 1
        const failed: GateVerdict = {
          allow: settings.commandGateOnJudgeFailure === 'allow',
          reason: `command gate judge failed (${outcome.reason})`,
          tier: 'failure',
        }
        this.log(agent, exec, command, failed)
        return failed
      } finally {
        this.release()
      }
    })()
    this.inFlight.set(key, started)
    try {
      const verdict = await started
      if (verdict.allow) stats.allows += 1
      else stats.denies += 1
      return verdict
    } finally {
      this.inFlight.delete(key)
    }
  }

  /** Deterministic denial; protected targets sharpen the reason. */
  private denyVerdict(settings: ShadowMindSettings, command: GateCommand): GateVerdict | undefined {
    for (const pattern of settings.commandGateDenyPatterns) {
      let regex: RegExp
      try {
        regex = new RegExp(pattern, 'iu')
      } catch {
        continue
      }
      if (!regex.test(command.command)) continue
      const protectedTarget = this.protectedTarget(settings, command.command)
      const reason = protectedTarget === undefined
        ? `blocked by Shadow Mind command gate: the command matches a deny pattern (${pattern})`
        : `blocked by Shadow Mind command gate: the command targets protected ${protectedTarget.kind} "${protectedTarget.name}"`
      return { allow: false, reason, tier: 'deny-pattern' }
    }
    return undefined
  }

  /** Named protected process or service the command mentions, when one does. */
  private protectedTarget(
    settings: ShadowMindSettings,
    command: string,
  ): { kind: 'process' | 'service'; name: string } | undefined {
    const folded = command.toLowerCase()
    for (const name of settings.commandGateProtectedProcesses) {
      if (name !== '' && folded.includes(name.toLowerCase())) return { kind: 'process', name }
    }
    for (const name of settings.commandGateProtectedServices) {
      if (name !== '' && folded.includes(name.toLowerCase())) return { kind: 'service', name }
    }
    return undefined
  }

  /** Deterministic read-only allowance. */
  private allows(settings: ShadowMindSettings, command: GateCommand): boolean {
    for (const pattern of settings.commandGateAllowPatterns) {
      let regex: RegExp
      try {
        regex = new RegExp(pattern, 'iu')
      } catch {
        continue
      }
      if (regex.test(command.command)) return true
    }
    return false
  }

  /** Wait for a judge slot; the caller signal releases the wait immediately. */
  private acquire(signal: AbortSignal): Promise<void> {
    if (this.active < this.runtime.settings().commandGateMaxParallel) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const release = (): void => {
        signal.removeEventListener('abort', onAbort)
        this.active += 1
        resolve()
      }
      const onAbort = (): void => {
        const index = this.queue.indexOf(release)
        if (index >= 0) this.queue.splice(index, 1)
        signal.removeEventListener('abort', onAbort)
        reject(new Error('aborted while queued for the command gate judge'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      this.queue.push(release)
    })
  }

  /** Hand one freed slot to the oldest queued waiter. */
  private release(): void {
    const next = this.queue.shift()
    if (next === undefined) {
      this.active -= 1
      return
    }
    next()
  }

  /** Failure policy applied when the judge exceeds its configured deadline. */
  private timeoutFailure(settings: ShadowMindSettings, signal: AbortSignal): Promise<GateJudgeOutcome> {
    return new Promise<GateJudgeOutcome>((resolve) => {
      const onAbort = (): void => {
        clearTimeout(timer)
        resolve({ kind: 'failure', reason: 'judge aborted with the root turn' })
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve({
          kind: 'failure',
          reason: `judge timed out after ${String(settings.commandGateJudgeTimeoutSeconds)}s`,
        })
      }, settings.commandGateJudgeTimeoutSeconds * 1_000)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  /** Append one diagnostic record; storage failures are contained. */
  private log(agent: Agent, exec: ToolExecution, command: GateCommand, verdict: GateVerdict): void {
    try {
      this.runtime.appendGateLog(agent, {
        time: new Date().toISOString(),
        tool: command.toolName,
        callId: String(exec.callId),
        command: command.command,
        tier: verdict.tier,
        allow: verdict.allow,
        reason: verdict.reason,
      })
    } catch {
      // Diagnostics must never turn a gate decision into a tool failure.
    }
  }
}
