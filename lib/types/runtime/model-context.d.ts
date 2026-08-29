/**
 * Model-derived prompt capacity for Shadow runs. When the selected model
 * advertises its context window, an unset `maxPromptChars` derives a prompt cap
 * from it so an oversized trajectory is trimmed instead of rejected by the
 * provider. Lookup failures degrade to "unknown" and impose no cap.
 * @module @whutzefengxie-ops/dsh-shadow-mind/model-context
 */
import type { Context } from '@deepseek-ai/cordis';
/** Harness-standard heuristic shared with the token meter: one token ≈ four characters. */
export declare const SHADOW_PROMPT_CHARS_PER_TOKEN = 4;
/**
 * Character headroom reserved inside the shared request/response window for the
 * Shadow's own report, reasoning, and tool reads.
 */
export declare const SHADOW_PROMPT_RESERVE_CHARS = 16384;
/**
 * Resolve a conservative prompt character cap for one provider/model route.
 * @param ctx Cordis context owning the optional LLM service.
 * @param route Provider/model route, or `undefined` to inherit the root route.
 * @returns The derived cap in characters, or 0 when no cap is known.
 */
export declare function resolveModelPromptCapChars(ctx: Context, route: string | undefined): Promise<number>;
/**
 * Combine a user-configured prompt bound with a model-derived cap. A positive
 * user bound always wins when no model cap is known; when both exist the
 * stricter one applies.
 * @param userBound `maxPromptChars`; 0 means unset.
 * @param modelCap Model-derived cap; 0 means unknown.
 * @returns The effective bound; 0 means unlimited.
 */
export declare function effectivePromptCapChars(userBound: number, modelCap: number): number;
