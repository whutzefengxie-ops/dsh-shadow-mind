/** Privacy-preserving root-session projection for fresh Shadow runs. @module @whutzefengxie-ops/dsh-shadow-mind/trajectory */
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { ShadowDefinition, ShadowMindSettings } from './types.ts';
/** One projected transcript plus the exact durable anchors visible in it. */
export interface ProjectedTrajectory {
    /** Model-visible trajectory text. */
    readonly text: string;
    /** Sequence numbers rendered into the text. */
    readonly seqs: ReadonlySet<number>;
}
/**
 * Summarize a tool result without disclosing its text.
 * @param toolName Tool name paired from the durable call event.
 * @param content Model-facing result content.
 * @param failed Whether the result carries a tool error.
 * @param meta Optional durable result metadata used only when its known fields validate.
 * @returns Deterministic compact summary.
 */
export declare function summarizeToolResult(toolName: string, content: readonly ContentBlock[], failed: boolean, meta?: unknown): string;
/**
 * Project a session prefix into a stable, reasoning-free text transcript.
 * @param events Complete root session events.
 * @param capturedThroughSeq Inclusive event sequence watermark.
 * @param argumentDisclosure Tool argument policy.
 * @param capture Root trajectory window policy.
 * @returns Plain-text trajectory.
 */
export declare function projectTrajectoryWithAnchors(events: readonly SessionEvent[], capturedThroughSeq: number, argumentDisclosure: ShadowMindSettings['argumentDisclosure'], capture?: ShadowDefinition['capture']): ProjectedTrajectory;
/**
 * Project a session prefix into a stable, reasoning-free text transcript.
 * @param events Complete root session events.
 * @param capturedThroughSeq Inclusive event sequence watermark.
 * @param argumentDisclosure Tool argument policy.
 * @param capture Root-log range to project.
 * @returns Plain-text trajectory.
 */
export declare function projectTrajectory(events: readonly SessionEvent[], capturedThroughSeq: number, argumentDisclosure: ShadowMindSettings['argumentDisclosure'], capture?: ShadowDefinition['capture']): string;
/**
 * Build the complete fresh-child prompt and fail closed above its configured
 * bound; a bound of zero (or less) disables the limit.
 * @param definition Selected Shadow definition.
 * @param trajectory Projected root trajectory.
 * @param capturedThroughSeq Inclusive root sequence watermark.
 * @param maxPromptChars Complete prompt bound; 0 = unlimited.
 * @returns Framed Shadow task.
 */
export declare function buildShadowPrompt(definition: ShadowDefinition, trajectory: string, capturedThroughSeq: number, maxPromptChars: number): string;
