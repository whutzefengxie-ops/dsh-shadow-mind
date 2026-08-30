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
 * - `repetition` — the recent stream suffix collapses into consecutive copies
 *   of one short token block;
 * - `output-budget` — the child streams more than a generous character budget
 *   without a single tool call.
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
/**
 * Streamed characters a Shadow child may produce between tool calls before the
 * guard fires `output-budget`. Deliberately generous: a max-effort tool-free
 * planning step legitimately streams tens of thousands of characters, while a
 * stuck child reaches this budget within minutes.
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
 * and every `tool/call` into {@link observeToolCall}; the first fired
 * classification is terminal and later observations are ignored.
 */
export declare class DegenerateOutputGuard {
    private tail;
    private sinceToolCall;
    private fired;
    /**
     * Observe one streamed text chunk.
     * @param text - the chunk text.
     * @returns the fired classification, or undefined while the stream looks healthy.
     */
    observeChunk(text: string): DegenerateOutputDetection | undefined;
    /** Observe one tool call: the child is progressing, so the budget restarts. */
    observeToolCall(): void;
}
