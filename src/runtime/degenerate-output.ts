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
export type DegenerateOutputReason = 'repetition' | 'output-budget'

/** One fired degenerate-output classification. */
export interface DegenerateOutputDetection {
  readonly reason: DegenerateOutputReason
}

/** Which stream a chunk belongs to; only visible text feeds the output budget. */
export type DegenerateChunkKind = 'text' | 'reasoning'

/** Smallest repeated block length considered a signal (shorter blocks are noise-prone). */
const REPETITION_MIN_PERIOD = 4
/**
 * Largest repeated block length checked. Covers the 12-char `<tool_calls>`
 * marker with room, and also two-token alternations (e.g. `<tool_calls>\n`
 * alternating with `<tool_calls>`, whose combined period is 25): the combined
 * pair repeats as one longer block. Longer rotations and single-character
 * floods stay with the output-budget backstop.
 */
const REPETITION_MAX_PERIOD = 32
/** Consecutive identical blocks required before the guard fires. */
const REPETITION_REPEATS = 4
/** Rolling suffix kept for the repetition check. */
const REPETITION_TAIL_CAP = REPETITION_MAX_PERIOD * REPETITION_REPEATS
/** A letter or digit in the current locale. */
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/**
 * Visible text characters a Shadow child may stream between progress signals
 * (tool calls or step/turn boundaries) before the guard fires
 * `output-budget`. Deliberately generous: a healthy child's visible text in
 * one stretch is far smaller, while a stuck text flood reaches this budget
 * within minutes. Reasoning deltas never count — max-effort planning steps
 * legitimately stream very long reasoning, and their loops are cut by the
 * repetition rule instead.
 */
export const MAX_CHARS_WITHOUT_TOOL_CALL = 96_000

/** Whether a repeated block is a meaningful signal rather than punctuation or a single repeated character. */
function isSignalBlock(block: string): boolean {
  let hasLetterOrDigit = false
  let hasNonWhitespace = false
  for (const ch of block) {
    if (!hasLetterOrDigit && LETTER_OR_DIGIT.test(ch)) hasLetterOrDigit = true
    if (!hasNonWhitespace && ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\r') hasNonWhitespace = true
  }
  return hasLetterOrDigit && hasNonWhitespace && new Set(block).size >= 2
}

/**
 * Whether the stream suffix is `REPETITION_REPEATS` consecutive copies of one
 * block whose length lies in the configured period range. Pure so tests can
 * exercise the exact thresholds without a live stream.
 * @param text - the streamed text suffix, most recent characters last.
 * @returns whether the suffix is a degenerate repetition.
 */
export function hasRepeatedSuffix(text: string): boolean {
  if (text.length < REPETITION_MIN_PERIOD * REPETITION_REPEATS) return false
  for (let period = REPETITION_MIN_PERIOD; period <= REPETITION_MAX_PERIOD; period++) {
    const span = period * REPETITION_REPEATS
    if (text.length < span) continue
    const block = text.slice(-period)
    if (!isSignalBlock(block)) continue
    let repeated = true
    // Compare the three preceding blocks against the suffix block; offsets are
    // anchored at the end of the text, not at zero, because the watched tail is
    // usually longer than the repeated span.
    for (let offset = text.length - period * 2; offset >= text.length - span; offset -= period) {
      if (text.slice(offset, offset + period) !== block) {
        repeated = false
        break
      }
    }
    if (repeated) return true
  }
  return false
}

/**
 * Rolling one-shot watchdog over one Shadow child's streamed output.
 * Feed every `text-delta` / `reasoning-delta` chunk into {@link observeChunk}
 * with its kind, every `tool/call` into {@link observeToolCall}, and every
 * `step/end` / `turn/end` into {@link observeBoundary}; the first fired
 * classification is terminal and later observations are ignored.
 */
export class DegenerateOutputGuard {
  private tail = ''
  private textSinceReset = 0
  private fired: DegenerateOutputReason | undefined

  /**
   * Observe one streamed chunk.
   * @param text - the chunk text.
   * @param kind - whether the chunk is visible text or reasoning; only visible
   *   text feeds the output budget, while both kinds feed the repetition tail.
   * @returns the fired classification, or undefined while the stream looks healthy.
   */
  observeChunk(text: string, kind: DegenerateChunkKind): DegenerateOutputDetection | undefined {
    if (this.fired !== undefined || text === '') return undefined
    if (kind === 'text') {
      this.textSinceReset += text.length
      if (this.textSinceReset > MAX_CHARS_WITHOUT_TOOL_CALL) {
        this.fired = 'output-budget'
        return { reason: 'output-budget' }
      }
    }
    this.tail = (this.tail + text).slice(-REPETITION_TAIL_CAP)
    if (hasRepeatedSuffix(this.tail)) {
      this.fired = 'repetition'
      return { reason: 'repetition' }
    }
    return undefined
  }

  /** Observe one tool call: the child is progressing, so the budget restarts. */
  observeToolCall(): void {
    this.textSinceReset = 0
  }

  /**
   * Observe one step or turn boundary: a fresh step starts a fresh budget, so
   * a long but healthy tool-free planning step can never bleed its text into
   * the following investigation step.
   */
  observeBoundary(): void {
    this.textSinceReset = 0
  }
}
