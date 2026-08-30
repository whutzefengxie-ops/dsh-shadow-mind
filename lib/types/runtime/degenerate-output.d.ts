/**
 * Degenerate-output watchdog for Shadow children.
 *
 * A reviewer child can fall into a run-away stream instead of calling its
 * tools: the model emits the same short token (e.g. a bare `<tool_calls>`
 * marker) forever, or streams unbounded text without ever calling a tool.
 * The turn then never ends, the structured-output contract is never met, and
 * the Shadow run occupies its single slot until the run timeout — burning
 * output tokens the whole time.
 *
 * The guard tracks the child's streamed text and tool activity. It fires once
 * on either condition:
 *
 * - `repetition` — the recent stream suffix (text AND reasoning) collapses
 *   into consecutive copies of one short token block;
 * - `output-budget` — the child streams more than a generous budget of VISIBLE
 *   text between progress signals (tool calls or step/turn boundaries).
 *
 * The budget deliberately ignores reasoning deltas: max-effort planning steps
 * legitimately reason for tens of thousands of characters, while a stuck child
 * floods its text output (the observed failure emitted the marker as text).
 * Reasoning loops are still cut by the repetition rule; only text floods and
 * rotations longer than the repetition window rely on the budget.
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
/** Which stream a chunk belongs to; only visible text feeds the output budget. */
export type DegenerateChunkKind = 'text' | 'reasoning';
/**
 * Visible text characters a Shadow child may stream between progress signals
 * (tool calls or step/turn boundaries) before the guard fires
 * `output-budget`. Deliberately generous: a healthy child's visible text in
 * one stretch is far smaller, while a stuck text flood reaches this budget
 * within minutes. Reasoning deltas never count — max-effort planning steps
 * legitimately stream very long reasoning, and their loops are cut by the
 * repetition rule instead.
 */
export declare const MAX_CHARS_WITHOUT_TOOL_CALL = 96000;
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
    private tail;
    private textSinceReset;
    private fired;
    /**
     * Observe one streamed chunk.
     * @param text - the chunk text.
     * @param kind - whether the chunk is visible text or reasoning; only visible
     *   text feeds the output budget, while both kinds feed the repetition tail.
     * @returns the fired classification, or undefined while the stream looks healthy.
     */
    observeChunk(text: string, kind: DegenerateChunkKind): DegenerateOutputDetection | undefined;
    /** Observe one tool call: the child is progressing, so the budget restarts. */
    observeToolCall(): void;
    /**
     * Observe one step or turn boundary: a fresh step starts a fresh budget, so
     * a long but healthy tool-free planning step can never bleed its text into
     * the following investigation step.
     */
    observeBoundary(): void;
}
