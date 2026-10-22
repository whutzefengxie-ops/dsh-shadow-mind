/**
 * Dedicated fresh Shadow children under DSH activation ownership. Review hooks
 * are installed before first input; caller delivery keeps reports under Shadow
 * validation and batching rather than DSH automatic parent notification.
 * @module @whutzefengxie-ops/dsh-shadow-mind/subagent-provider
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Agent, ModelSelection } from '@deepseek-ai/dsh-agent';
import type { SubagentStartRequest, SubagentRun } from '@deepseek-ai/dsh-subagent';
import type { ToolRestriction } from '@deepseek-ai/dsh-tools';
import { type DegenerateOutputReason } from './degenerate-output.ts';
export { STRUCTURED_OUTPUT_TOOL, STRUCTURED_OUTPUT_INSTRUCTION, } from './structured-output.ts';
declare module '@deepseek-ai/dsh-subagent' {
    interface SubagentCapabilities {
        /** Shadow provider supports a per-review tool restriction. */
        readonly toolFilter?: boolean;
        /** Shadow provider supports a per-review persona. */
        readonly persona?: boolean;
        /** Complete per-run model selection; absence is equivalent to false. */
        readonly modelSelection?: boolean;
        /** Per-run runtime-context inheritance policy; absence is equivalent to false. */
        readonly contextInheritance?: boolean;
        /** Two-step tool-free planning before investigation; absence is equivalent to false. */
        readonly thinkFirst?: boolean;
    }
    interface SubagentStartRequest {
        /** Shadow-specific composition applied before its initial prompt is delivered. */
        readonly toolFilter?: ToolRestriction;
        readonly persona?: string;
        /** Complete provider, model, and reasoning-effort selection for one child. */
        readonly modelSelection?: ModelSelection;
        /** Runtime-context inheritance policy for one child. */
        readonly contextInheritance?: 'standard' | 'none';
        /** Whether this child plans once without tools before investigating. */
        readonly thinkFirst?: boolean;
        /**
         * Rendered trajectory anchors the child may cite in structured `refs`;
         * the child-side `structured_output` tool rejects other seq values in-turn.
         */
        readonly structuredAnchorSeqs?: ReadonlySet<number>;
    }
    interface SubagentStopReasonMap {
        /** The child's turn completed normally but never satisfied the structured-output contract. */
        'no-structured-output': 'no-structured-output';
        /** The child's stream collapsed into a degenerate repetition or a tool-free output flood and was cancelled. */
        'degenerate-output': 'degenerate-output';
    }
}
/** Provider name reserved for Shadow Mind's conditioned fresh children. */
export declare const SHADOW_MIND_SUBAGENT_PROVIDER = "shadow-mind";
/** Model-visible continuation injected after the tool-free planning request. */
export declare const THINK_FIRST_CONTINUATION = "Planning is complete. Now investigate with the available tools and submit the required final result.";
/** Provider-authored reason for a turn that completed without the structured-output contract. */
export declare const STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC = "Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.";
/** Provider-authored diagnostics for children cancelled by the degenerate-output watchdog. */
export declare const DEGENERATE_OUTPUT_DIAGNOSTICS: Readonly<Record<DegenerateOutputReason, string>>;
/** Mutable degenerate-output state shared between the child scope and the settled run reader. */
export interface DegenerateOutputState {
    reason: DegenerateOutputReason | undefined;
}
/** A caller-owned review receipt retaining its settled local evidence. */
export interface ShadowMindRun extends SubagentRun {
    readonly localAgent?: Agent | undefined;
}
/**
 * Start a caller-delivered activation. DSH owns creation, policy inheritance,
 * directory selection, capacity, and teardown. The serial agent/created hook
 * installs review conditioning before the manager delivers the first prompt.
 */
export declare function startShadowMindRun(ctx: Context, request: SubagentStartRequest): Promise<ShadowMindRun>;
/** Register the provider in the calling plugin scope. */
export declare function installShadowMindProvider(ctx: Context): void;
