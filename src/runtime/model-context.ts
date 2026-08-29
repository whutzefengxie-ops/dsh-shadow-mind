/**
 * Model-derived prompt capacity for Shadow runs. When the selected model
 * advertises its context window, an unset `maxPromptChars` derives a prompt cap
 * from it so an oversized trajectory is trimmed instead of rejected by the
 * provider. Lookup failures degrade to "unknown" and impose no cap.
 * @module @whutzefengxie-ops/dsh-shadow-mind/model-context
 */

import type { Context } from '@deepseek-ai/cordis'

/** Harness-standard heuristic shared with the token meter: one token ≈ four characters. */
export const SHADOW_PROMPT_CHARS_PER_TOKEN = 4
/**
 * Character headroom reserved inside the shared request/response window for the
 * Shadow's own report, reasoning, and tool reads.
 */
export const SHADOW_PROMPT_RESERVE_CHARS = 16_384

/** Narrow service surface consumed by the capacity resolver. */
interface LlmContextFace {
  resolveModelInfo(
    provider: string,
    model: string,
  ): Promise<{ readonly context?: { readonly contextWindow?: number } } | undefined>
}

/**
 * Resolve a conservative prompt character cap for one provider/model route.
 * @param ctx Cordis context owning the optional LLM service.
 * @param route Provider/model route, or `undefined` to inherit the root route.
 * @returns The derived cap in characters, or 0 when no cap is known.
 */
export async function resolveModelPromptCapChars(ctx: Context, route: string | undefined): Promise<number> {
  if (route === undefined) return 0
  const slash = route.indexOf('/')
  if (slash <= 0 || slash === route.length - 1) return 0
  const llm = ctx.get('llm') as LlmContextFace | undefined
  if (llm === undefined) return 0
  try {
    const info = await llm.resolveModelInfo(route.slice(0, slash), route.slice(slash + 1))
    const window = info?.context?.contextWindow
    if (window === undefined || !Number.isFinite(window) || window <= 0) return 0
    return Math.max(0, Math.floor(window * SHADOW_PROMPT_CHARS_PER_TOKEN) - SHADOW_PROMPT_RESERVE_CHARS)
  } catch {
    // Adapter lookup is advisory: a failing catalog query must not fail the run.
    return 0
  }
}

/**
 * Combine a user-configured prompt bound with a model-derived cap. A positive
 * user bound always wins when no model cap is known; when both exist the
 * stricter one applies.
 * @param userBound `maxPromptChars`; 0 means unset.
 * @param modelCap Model-derived cap; 0 means unknown.
 * @returns The effective bound; 0 means unlimited.
 */
export function effectivePromptCapChars(userBound: number, modelCap: number): number {
  if (userBound > 0) return modelCap > 0 ? Math.min(userBound, modelCap) : userBound
  return modelCap
}
