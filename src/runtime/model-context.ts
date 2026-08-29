/**
 * Model-derived prompt capacity for Shadow runs. When the selected model
 * advertises its context window, an unset `maxPromptChars` derives a token
 * budget from it so an oversized trajectory is trimmed before the provider can
 * reject it. Lookup failures degrade to "unknown" and impose no cap.
 * @module @whutzefengxie-ops/dsh-shadow-mind/model-context
 */

import type { Context } from '@deepseek-ai/cordis'

/**
 * Fallback token headroom reserved inside the shared request/response window
 * for the Shadow's own report, reasoning, and tool reads, used when the adapter
 * does not disclose its per-request output cap (`defaultMaxTokens`).
 */
export const SHADOW_PROMPT_RESERVE_TOKENS = 8_192

/**
 * Estimated characters per token for text outside the dense CJK scripts.
 * Two characters per token (0.5 token/char) sits well above DeepSeek's
 * published English density of roughly 0.3 token/char and covers typical code
 * and JSON, leaving a ≥1.5x safety margin for prose.
 */
export const SHADOW_PROMPT_NON_CJK_CHARS_PER_TOKEN = 2

/**
 * Characters that tokenize densely: CJK ideographs (unified, extensions B–H,
 * compatibility, and supplementary), kana, Hangul, bopomofo, and CJK/fullwidth
 * punctuation. Extension characters occupy two UTF-16 units and are counted as
 * two estimated tokens each, which overestimates their typical cost.
 */
const CJK_CHARACTER = /[\u2e80-\u2eff\u3000-\u303f\u3040-\u30ff\u3100-\u312f\u31c0-\u31ef\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef\u{20000}-\u{323af}]/u

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
export function estimateTextTokens(text: string): number {
  let dense = 0
  for (const char of text) {
    // Code-point iteration: extension characters carry two UTF-16 units.
    if (CJK_CHARACTER.test(char)) dense += char.length
  }
  return dense + Math.ceil((text.length - dense) / SHADOW_PROMPT_NON_CJK_CHARS_PER_TOKEN)
}

/** Narrow service surface consumed by the capacity resolver. */
interface LlmContextFace {
  resolveModelInfo(
    provider: string,
    model: string,
  ): Promise<{
    readonly context?: { readonly contextWindow?: number }
    readonly defaultMaxTokens?: number
  } | undefined>
}

/**
 * Resolve a conservative prompt token budget for one provider/model route: the
 * model's combined request/response window minus the response side. The
 * response side is the adapter-disclosed per-request output cap when known,
 * otherwise the fallback reserve.
 * @param ctx Cordis context owning the optional LLM service.
 * @param route Provider/model route, or `undefined` to inherit the root route.
 * @returns The derived budget in estimated tokens, or 0 when no budget is known.
 */
export async function resolveModelPromptTokenBudget(ctx: Context, route: string | undefined): Promise<number> {
  if (route === undefined) return 0
  const slash = route.indexOf('/')
  if (slash <= 0 || slash === route.length - 1) return 0
  const llm = ctx.get('llm') as LlmContextFace | undefined
  if (llm === undefined) return 0
  try {
    const info = await llm.resolveModelInfo(route.slice(0, slash), route.slice(slash + 1))
    const window = info?.context?.contextWindow
    if (window === undefined || !Number.isFinite(window) || window <= 0) return 0
    const disclosed = info?.defaultMaxTokens
    const reserve = disclosed !== undefined && Number.isFinite(disclosed) && disclosed > 0
      ? disclosed
      : SHADOW_PROMPT_RESERVE_TOKENS
    if (window <= reserve) return 0
    return Math.floor(window - reserve)
  } catch {
    // Adapter lookup is advisory: a failing catalog query must not fail the run.
    return 0
  }
}
