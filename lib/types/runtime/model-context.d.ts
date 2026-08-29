/**
 * Model-derived prompt capacity for Shadow runs. When the selected model
 * advertises its context window, an unset `maxPromptChars` derives a token
 * budget from it so an oversized trajectory is trimmed before the provider can
 * reject it. Lookup failures degrade to "unknown" and impose no cap.
 * @module @whutzefengxie-ops/dsh-shadow-mind/model-context
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * Fallback token headroom reserved inside the shared request/response window
 * for the Shadow's own report, reasoning, and tool reads, used when the adapter
 * does not disclose its per-request output cap (`defaultMaxTokens`).
 */
export declare const SHADOW_PROMPT_RESERVE_TOKENS = 8192;
/**
 * Estimated characters per token for text outside the dense CJK scripts.
 * Two characters per token (0.5 token/char) sits well above DeepSeek's
 * published English density of roughly 0.3 token/char and covers typical code
 * and JSON, leaving a ≥1.5x safety margin for prose.
 */
export declare const SHADOW_PROMPT_NON_CJK_CHARS_PER_TOKEN = 2;
/**
 * Conservative token estimate that needs no tokenizer, calibrated against
 * DeepSeek's published densities: roughly 0.3 tokens per English character and
 * 0.6 tokens per Chinese character. CJK and related scripts count one token per
 * UTF-16 unit (a conservative upper bound for their average density), and all
 * other text counts two characters per token. The result is an estimate, not a
 * mathematical upper bound: byte-fallback content (random symbols, rare
 * out-of-vocabulary characters) can still tokenize denser than estimated, and
 * the reserved response headroom absorbs that tail.
 * @param text Text to estimate.
 * @returns Estimated token count.
 */
export declare function estimateTextTokens(text: string): number;
/**
 * Resolve a conservative prompt token budget for one provider/model route: the
 * model's combined request/response window minus the response side. The
 * response side is the adapter-disclosed per-request output cap when known,
 * otherwise the fallback reserve.
 * @param ctx Cordis context owning the optional LLM service.
 * @param route Provider/model route, or `undefined` to inherit the root route.
 * @returns The derived budget in estimated tokens, or 0 when no budget is known.
 */
export declare function resolveModelPromptTokenBudget(ctx: Context, route: string | undefined): Promise<number>;
