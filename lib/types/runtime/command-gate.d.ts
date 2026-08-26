/**
 * Root-agent command gate: deterministic deny/allow tiers plus an LLM gate
 * judge that runs inside `tools/pre-execute`, so the root agent's turn blocks
 * until a verdict admits or refuses one pwsh-style command. The primary
 * scenario is preventing the root agent from killing production services
 * while it edits a project.
 * @module @whutzefengxie-ops/dsh-shadow-mind/command-gate
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools';
import type { ShadowMindSettings } from './types.ts';
/** Structured verdict schema the gate judge must answer with. */
export declare const GATE_OUTPUT_SCHEMA: ObjectJsonSchema;
/** The command under review, extracted from the pending tool execution. */
export interface GateCommand {
    /** Exact command string the tool would execute. */
    readonly command: string;
    /** Tool-supplied human description, when present. */
    readonly description?: string;
    /** Tool-supplied working directory, when present. */
    readonly workdir?: string;
    /** Intercepted tool name. */
    readonly toolName: string;
}
/** One gate judge settlement. */
export type GateJudgeOutcome = {
    readonly kind: 'verdict';
    readonly allow: boolean;
    readonly reason: string;
} | {
    readonly kind: 'failure';
    readonly reason: string;
};
/** Decided tier of one verdict, kept for diagnostics. */
export type GateTier = 'deny-pattern' | 'allow-pattern' | 'judge' | 'cached' | 'failure';
/** One settled allow/deny verdict with its provenance. */
export interface GateVerdict {
    readonly allow: boolean;
    readonly reason: string;
    readonly tier: GateTier;
}
/** Per-root lifetime counters exposed through {@link ShadowMindStatus}. */
export interface CommandGateStats {
    denies: number;
    allows: number;
    judgeRuns: number;
    judgeFailures: number;
}
/** Host surface the gate needs from the Shadow Mind runtime. */
export interface CommandGateRuntime {
    /** Live resolved settings snapshot. */
    settings(): ShadowMindSettings;
    /** Whether an agent is a top-level root rather than a subagent child. */
    isRoot(agent: Agent): boolean;
    /** Ask the gate judge to settle one command; failures never throw. */
    judgeVerdict(agent: Agent, command: GateCommand, signal: AbortSignal): Promise<GateJudgeOutcome>;
    /** Append one diagnostic record to the plugin-owned gate log. */
    appendGateLog(agent: Agent, record: Record<string, unknown>): void;
}
/** Empty counters for a fresh root. */
export declare function emptyCommandGateStats(): CommandGateStats;
/**
 * Deterministic tiers answer instantly; only the middle band reaches the
 * judge. Judge verdicts are cached per (agent, command) for the configured
 * TTL and deduplicated while in flight, and judge concurrency is capped so a
 * burst of ambiguous commands cannot spawn unbounded children.
 */
export declare class CommandGate {
    private readonly ctx;
    private readonly runtime;
    private readonly stats;
    private readonly cache;
    private readonly inFlight;
    private active;
    private readonly queue;
    constructor(ctx: Context, runtime: CommandGateRuntime);
    /** Register the pre-execute listener; returns its disposer. */
    install(): () => void;
    /** Per-root lifetime counters. */
    statsFor(agent: Agent): CommandGateStats;
    /** Drop every cached verdict; settings or user-input boundaries call this. */
    reset(): void;
    /** Whether this execution enters the gate, with its extracted command. */
    private interested;
    /** Run the tiered pipeline for one intercepted command. */
    private decide;
    /** Deterministic denial; protected targets sharpen the reason. */
    private denyVerdict;
    /** Named protected process or service the command mentions, when one does. */
    private protectedTarget;
    /** Deterministic read-only allowance. */
    private allows;
    /** Wait for a judge slot; the caller signal releases the wait immediately. */
    private acquire;
    /** Hand one freed slot to the oldest queued waiter. */
    private release;
    /** Failure policy applied when the judge exceeds its configured deadline. */
    private timeoutFailure;
    /** Append one diagnostic record; storage failures are contained. */
    private log;
}
