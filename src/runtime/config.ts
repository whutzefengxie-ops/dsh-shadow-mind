/** Shadow Mind deployment and user-settings schemas. @module @whutzefengxie-ops/dsh-shadow-mind/config */

import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { SHADOW_MODEL_ROUTE_PATTERN } from './model-route.ts'
import type { ShadowMindConfig, ShadowMindSettings } from './types.ts'

/** Default probability of evaluating Shadows after an eligible root turn. */
export const DEFAULT_HEARTBEAT_PROBABILITY = 1 / 3
/** Default maximum active Shadows per root. */
export const DEFAULT_MAX_PARALLEL_SHADOWS = 2
/** Default per-Shadow deadline in seconds. */
export const DEFAULT_SHADOW_TIMEOUT_SECONDS = 300
/** Default headless convergence deadline in seconds. */
export const DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS = 120
/** Default report batching window. */
export const DEFAULT_RESULT_BATCH_WINDOW_MS = 400
/** Default maximum framed prompt size. */
export const DEFAULT_MAX_PROMPT_CHARS = 120_000
/** Default maximum accepted report size. */
export const DEFAULT_MAX_REPORT_CHARS = 20_000
/** Default result size that activates the long-output review boost. */
export const DEFAULT_LONG_OUTPUT_BOOST_CHARS = 50_000
/** Default identical-envelope count required for last-report suppression. */
export const DEFAULT_LAST_REPORT_COVERS_COUNT = 2
/** Default same-tool failure count required for a review boost. */
export const DEFAULT_REPEATED_FAILURE_BOOST_THRESHOLD = 3
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
  heartbeatProbability: z.number().min(0).max(1).default(DEFAULT_HEARTBEAT_PROBABILITY),
  maxParallelShadows: z.number().step(1).min(1).default(DEFAULT_MAX_PARALLEL_SHADOWS),
  defaultShadowTimeoutSeconds: z.number().min(0.001).default(DEFAULT_SHADOW_TIMEOUT_SECONDS),
  headlessDrainTimeoutSeconds: z.number().min(0.001).default(DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS),
  resultBatchWindowMs: z.number().min(0).default(DEFAULT_RESULT_BATCH_WINDOW_MS),
  defaultShadowModel: z.string().pattern(SHADOW_MODEL_ROUTE_PATTERN),
  defaultReasoningEffort: z.string(),
  argumentDisclosure: z.union(['redacted', 'full'] as const).default('redacted'),
  randomSeed: z.number(),
  maxPromptChars: z.number().step(1).min(1).default(DEFAULT_MAX_PROMPT_CHARS),
  maxReportChars: z.number().step(1).min(1).default(DEFAULT_MAX_REPORT_CHARS),
  preferIndependentVendor: z.boolean().default(false),
  longOutputBoostChars: z.number().step(1).min(1).default(DEFAULT_LONG_OUTPUT_BOOST_CHARS),
  lastReportCoversCount: z.number().step(1).min(2).default(DEFAULT_LAST_REPORT_COVERS_COUNT),
  repeatedFailureBoostThreshold: z.number().step(1).min(2).default(DEFAULT_REPEATED_FAILURE_BOOST_THRESHOLD),
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
  frugalShadowModel: z.string().pattern(SHADOW_MODEL_ROUTE_PATTERN),
  staleReportDecay: z.number().min(0).max(1).default(0),
  conflictSynthesisEnabled: z.boolean().default(false),
  conflictSynthesisTimeoutSeconds: z.number().min(0.001).default(60),
})

/** User-editable settings plus cross-field budget and window validation. */
export const SHADOW_MIND_SETTINGS_SCHEMA: Schema<ShadowMindSettings> = z.transform(
  SHADOW_MIND_SETTINGS_OBJECT,
  (value) => {
    const settings = value as unknown as ShadowMindSettings
    const largestWindow = Math.max(
      settings.spinningRepeatCount,
      settings.oscillationPeriods * 2,
      settings.noDriftRepeatCount,
      settings.diminishingWindowSize,
    )
    if (settings.reviewWindowSize < largestWindow) {
      throw new Error('reviewWindowSize must cover every configured stagnation window')
    }
    if (settings.reasoningEffortLadder.some(value => value.trim() === '')
    || new Set(settings.reasoningEffortLadder).size !== settings.reasoningEffortLadder.length) {
      throw new Error('reasoningEffortLadder must contain unique non-empty values')
    }
    const soft = settings.sessionShadowSoftBudgetChars
    const hard = settings.sessionShadowHardBudgetChars
    if (soft !== undefined && (hard === undefined || settings.frugalShadowModel === undefined)) {
      throw new Error('sessionShadowSoftBudgetChars requires sessionShadowHardBudgetChars and frugalShadowModel')
    }
    if (soft !== undefined && hard !== undefined && soft >= hard) {
      throw new Error('sessionShadowSoftBudgetChars must be less than sessionShadowHardBudgetChars')
    }
    if (settings.frugalShadowModel !== undefined && soft === undefined) {
      throw new Error('frugalShadowModel requires sessionShadowSoftBudgetChars')
    }
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
