/**
 * Dedicated in-process provider for fresh Shadow children. The agent factory owns
 * unpublished setup and rollback; the returned run owns the published child through
 * result settlement and quiescent disposal.
 * @module @whutzefengxie-ops/dsh-shadow-mind/subagent-provider
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
export { STRUCTURED_OUTPUT_TOOL, STRUCTURED_OUTPUT_INSTRUCTION, } from './structured-output.ts';
declare module '@deepseek-ai/dsh-subagent' {
    interface SubagentCapabilities {
        /** Complete per-run model selection; absence is equivalent to false. */
        readonly modelSelection?: boolean;
        /** Per-run runtime-context inheritance policy; absence is equivalent to false. */
        readonly contextInheritance?: boolean;
        /** Two-step tool-free planning before investigation; absence is equivalent to false. */
        readonly thinkFirst?: boolean;
    }
    interface SubagentStartRequest {
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
    }
}
/** Provider name reserved for Shadow Mind's conditioned fresh children. */
export declare const SHADOW_MIND_SUBAGENT_PROVIDER = "shadow-mind";
/** Model-visible continuation injected after the tool-free planning request. */
export declare const THINK_FIRST_CONTINUATION = "Planning is complete. Now investigate with the available tools and submit the required final result.";
/** Provider-authored reason for a turn that completed without the structured-output contract. */
export declare const STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC = "Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.";
/** Register the provider in the calling plugin scope. */
export declare function installShadowMindProvider(ctx: Context): void;
