/**
 * Degenerate-output watchdog for Shadow children.
 *
 * A reviewer child can fall into a run-away stream instead of calling its
 * tools: the model emits the same short token (e.g. a bare `<tool_calls>`
 * marker) forever, or streams unbounded output without any progress signal.
 * The turn then never ends, the structured-output contract is never met, and
 * the Shadow run occupies its single slot until the run timeout — burning
 * output tokens the whole time.
 *
 * The guard tracks the child's streamed chunks and progress events. It fires
 * once on either condition:
 *
 * - `repetition` — the recent stream suffix (text AND reasoning) collapses
 *   into consecutive copies of one short token block;
 * - `output-budget` — the child streams more than its per-channel character
 *   budget between progress signals (tool calls or step/turn boundaries).
 *
 * The two channels carry separate budgets. Visible text keeps a tight budget:
 * a healthy child's text stretches are small, so a text flood is cut within
 * minutes. Reasoning keeps a much larger budget scaled by the child's
 * reasoning effort, because max-effort planning steps legitimately stream
 * very long reasoning; its loops are normally cut by the repetition rule,
 * and the effort-scaled budget is the backstop for repetition-bypassing
 * floods (single-character streams or rotations longer than the window).
 *
 * The provider cancels the child when the guard fires and reports the run as
 * `degenerate-output`, so the runtime can fail fast with an actionable reason
 * instead of spinning until the timeout.
 * @module @whutzefengxie-ops/dsh-shadow-mind/degenerate-output
 */
/** Why one child stream was classified as degenerate. */
export type DegenerateOutputReason = 'repetition' | 'output-budget';
/** One fired degenerate-output classification. */
export interface DegenerateOutputDetection {
    readonly reason: DegenerateOutputReason;
}
/** Which stream a chunk belongs to; each channel carries its own output budget. */
export type DegenerateChunkKind = 'text' | 'reasoning';
/**
 * Visible text characters a Shadow child may stream between progress signals
 * (tool calls or step/turn boundaries) before the guard fires
 * `output-budget`. Deliberately generous: a healthy child's visible text in
 * one stretch is far smaller, while a stuck text flood reaches this budget
 * within minutes.
 */
export declare const MAX_CHARS_WITHOUT_TOOL_CALL = 96000;
/**
 * Base reasoning characters a Shadow child may stream between progress
 * signals before the guard fires `output-budget`, before the reasoning-effort
 * multiplier (see {@link resolveReasoningBudget}). Reasoning is far noisier
 * than visible text: max-effort planning legitimately streams very long
 * reasoning, so the base alone only governs cheap efforts.
 */
export declare const MAX_REASONING_CHARS_BASE = 96000;
/**
 * Resolve one child's reasoning-channel output budget from its reasoning
 * effort. Unknown efforts inherit the heaviest multiplier — the budget is a
 * backstop, and a false kill on an expensive healthy run costs more than a
 * slower cutoff on a stuck one.
 * @param effort - the adapter-owned reasoning-effort id, or undefined.
 * @returns the reasoning budget in characters.
 */
export declare function resolveReasoningBudget(effort: string | undefined): number;
/**
 * Whether the stream suffix is `REPETITION_REPEATS` consecutive copies of one
 * block whose length lies in the configured period range. Pure so tests can
 * exercise the exact thresholds without a live stream.
 * @param text - the streamed text suffix, most recent characters last.
 * @returns whether the suffix is a degenerate repetition.
 */
export declare function hasRepeatedSuffix(text: string): boolean;
/**
 * Rolling one-shot watchdog over one Shadow child's streamed output.
 * Feed every `text-delta` / `reasoning-delta` chunk into {@link observeChunk}
 * with its kind, every `tool/call` into {@link observeToolCall}, and every
 * `step/end` / `turn/end` into {@link observeBoundary}; the first fired
 * classification is terminal and later observations are ignored.
 */
export declare class DegenerateOutputGuard {
    private readonly reasoningBudget;
    private tail;
    private textSinceReset;
    private reasoningSinceReset;
    private fired;
    /**
     * @param reasoningBudget - the reasoning-channel budget in characters
     *   (typically {@link resolveReasoningBudget} for the child's effort).
     */
    constructor(reasoningBudget?: number);
    /**
     * Observe one streamed chunk.
     * @param text - the chunk text.
     * @param kind - whether the chunk is visible text or reasoning; each channel
     *   feeds its own output budget, and both kinds feed the repetition tail.
     * @returns the fired classification, or undefined while the stream looks healthy.
     */
    observeChunk(text: string, kind: DegenerateChunkKind): DegenerateOutputDetection | undefined;
    /** Observe one tool call: the child is progressing, so both budgets restart. */
    observeToolCall(): void;
    /**
     * Observe one step or turn boundary: a fresh step starts fresh budgets, so
     * a long but healthy tool-free planning step can never bleed its output
     * into the following investigation step.
     */
    observeBoundary(): void;
}
