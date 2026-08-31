/** Shadow Mind deployment and user-settings schemas. @module @whutzefengxie-ops/dsh-shadow-mind/config */

import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { SHADOW_MODEL_ROUTE_PATTERN } from './model-route.ts'
import { DEFAULT_COLLAPSED_BY_DEFAULT, type ShadowMindConfig, type ShadowMindSettings } from './types.ts'

/** Default per-turn activation probability of the single Shadow reviewer. */
export const DEFAULT_ACTIVATION_PROBABILITY = 0.7
/** Default per-Shadow deadline in seconds (10 minutes: deep reviews frequently exceed the old 5-minute budget). */
export const DEFAULT_SHADOW_TIMEOUT_SECONDS = 600
/** Default headless convergence deadline in seconds. */
export const DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS = 120
/** Default report batching window. */
export const DEFAULT_RESULT_BATCH_WINDOW_MS = 400
/** Default maximum framed prompt size; 0 disables the limit. */
export const DEFAULT_MAX_PROMPT_CHARS = 0
/** Default maximum accepted report size; 0 disables the limit. */
export const DEFAULT_MAX_REPORT_CHARS = 0
/** Default root-turn observation window for challenge outcomes. */
export const DEFAULT_VALUE_LOOP_WINDOW_TURNS = 2
/** Default accepted-entry retention per root. */
export const DEFAULT_REVIEW_WINDOW_SIZE = 8
/** Default identical-envelope repeat count. */
export const DEFAULT_SPINNING_REPEAT_COUNT = 3
/** Default alternating verdict period count. */
export const DEFAULT_OSCILLATION_PERIODS = 2
/** Default unchanged confirmation repeat count. */
export const DEFAULT_NO_DRIFT_REPEAT_COUNT = 3
/** Default diminishing-novelty suffix length. */
export const DEFAULT_DIMINISHING_WINDOW_SIZE = 5
/** Default minimum novel-envelope share. */
export const DEFAULT_DIMINISHING_NOVELTY_THRESHOLD = 0.4
/** Default wall-clock stagnation cooldown in seconds. */
export const DEFAULT_STAGNATION_COOLDOWN_SECONDS = 300

/** User-editable Shadow Mind settings schema. */
const SHADOW_MIND_SETTINGS_OBJECT = z.object({
  defaultShadowTimeoutSeconds: z.number().min(0.001).default(DEFAULT_SHADOW_TIMEOUT_SECONDS),
  headlessDrainTimeoutSeconds: z.number().min(0.001).default(DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS),
  resultBatchWindowMs: z.number().min(0).default(DEFAULT_RESULT_BATCH_WINDOW_MS),
  argumentDisclosure: z.union(['redacted', 'full'] as const).default('redacted'),
  randomSeed: z.number(),
  maxPromptChars: z.number().step(1).min(0).default(DEFAULT_MAX_PROMPT_CHARS),
  maxReportChars: z.number().step(1).min(0).default(DEFAULT_MAX_REPORT_CHARS),
  valueLoopEnabled: z.boolean().default(true),
  valueLoopWindowTurns: z.number().step(1).min(1).default(DEFAULT_VALUE_LOOP_WINDOW_TURNS),
  reviewWindowSize: z.number().step(1).min(2).default(DEFAULT_REVIEW_WINDOW_SIZE),
  spinningRepeatCount: z.number().step(1).min(2).default(DEFAULT_SPINNING_REPEAT_COUNT),
  oscillationPeriods: z.number().step(1).min(2).default(DEFAULT_OSCILLATION_PERIODS),
  noDriftRepeatCount: z.number().step(1).min(2).default(DEFAULT_NO_DRIFT_REPEAT_COUNT),
  diminishingWindowSize: z.number().step(1).min(2).default(DEFAULT_DIMINISHING_WINDOW_SIZE),
  diminishingNoveltyThreshold: z.number().min(0).max(1).default(DEFAULT_DIMINISHING_NOVELTY_THRESHOLD),
  stagnationCooldownSeconds: z.number().min(0).default(DEFAULT_STAGNATION_COOLDOWN_SECONDS),
  stagnationEscalationEnabled: z.boolean().default(false),
  reasoningEffortLadder: z.array(z.string()).default(['low', 'medium', 'high']),
  sessionShadowSoftBudgetChars: z.number().step(1).min(1),
  sessionShadowHardBudgetChars: z.number().step(1).min(1),
  // Route shape is healed (invalid values are dropped) in the transform below,
  // so a half-typed override degrades to unset instead of rejecting the config.
  frugalShadowModel: z.string(),
  staleReportDecay: z.number().min(0).max(1).default(0),
  // Browser-only presentation preference; the runtime stores and serves it
  // without consuming it, so the Web card and settings tab share one source.
  collapsedByDefault: z.boolean().default(DEFAULT_COLLAPSED_BY_DEFAULT),
})

/** Settings shape whose properties the healing transform may rewrite in place. */
type MutableShadowMindSettings = { -readonly [K in keyof ShadowMindSettings]: ShadowMindSettings[K] }

/**
 * User-editable settings plus cross-field healing. Availability first: an
 * inconsistent advanced combination degrades to a usable default instead of
 * throwing, so leftover or half-edited values can never brick the plugin.
 */
export const SHADOW_MIND_SETTINGS_SCHEMA: Schema<ShadowMindSettings> = z.transform(
  SHADOW_MIND_SETTINGS_OBJECT,
  (value) => {
    const settings = { ...value as unknown as ShadowMindSettings } as MutableShadowMindSettings

    // Widen the review window to cover every configured stagnation window;
    // a user tuning one stagnation knob must not invalidate the whole config.
    const largestWindow = Math.max(
      settings.spinningRepeatCount,
      settings.oscillationPeriods * 2,
      settings.noDriftRepeatCount,
      settings.diminishingWindowSize,
    )
    if (settings.reviewWindowSize < largestWindow) settings.reviewWindowSize = largestWindow

    // Drop blanks and duplicates; an unusable ladder falls back to the default.
    const ladder = [...new Set(settings.reasoningEffortLadder.map(item => item.trim()).filter(item => item !== ''))]
    settings.reasoningEffortLadder = ladder.length === 0 ? ['low', 'medium', 'high'] : ladder

    // A partial or inconsistent frugal budget tier disables itself (unset means
    // unlimited spend on the standard route) instead of rejecting the config.
    let soft = settings.sessionShadowSoftBudgetChars
    let hard = settings.sessionShadowHardBudgetChars
    let frugal = settings.frugalShadowModel?.trim()
    if (frugal !== undefined && !SHADOW_MODEL_ROUTE_PATTERN.test(frugal)) frugal = undefined
    if (soft !== undefined && (hard === undefined || frugal === undefined)) soft = undefined
    if (frugal !== undefined && soft === undefined) frugal = undefined
    if (soft !== undefined && hard !== undefined && soft >= hard) {
      soft = undefined
      hard = undefined
      frugal = undefined
    }
    if (soft === undefined) delete settings.sessionShadowSoftBudgetChars
    else settings.sessionShadowSoftBudgetChars = soft
    if (hard === undefined) delete settings.sessionShadowHardBudgetChars
    else settings.sessionShadowHardBudgetChars = hard
    if (frugal === undefined) delete settings.frugalShadowModel
    else settings.frugalShadowModel = frugal
    return settings
  },
  true,
) as Schema<ShadowMindSettings>

/** Cordis plugin configuration schema. */
export const Config = z.intersect([
  SHADOW_MIND_SETTINGS_SCHEMA,
  z.object({ dshHome: z.string() }),
]) as unknown as Schema<ShadowMindConfig>

/**
 * Resolve and validate settings without retaining caller aliases.
 * @param config Deployment configuration and optional settings base.
 * @returns Complete validated settings.
 */
export function resolveSettings(config: ShadowMindConfig = {}): ShadowMindSettings {
  const { dshHome: _dshHome, ...settings } = config
  return SHADOW_MIND_SETTINGS_SCHEMA(settings as ShadowMindSettings)
}

/**
 * Extract only settings fields supplied by plugin configuration.
 * @param config Deployment configuration.
 * @returns User-setting base without the Harness home override.
 */
export function settingsBase(config: ShadowMindConfig): Partial<ShadowMindSettings> {
  const { dshHome: _dshHome, ...base } = config
  return base
}
