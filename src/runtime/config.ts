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

/** User-editable Shadow Mind settings schema. */
export const SHADOW_MIND_SETTINGS_SCHEMA: Schema<ShadowMindSettings> = z.object({
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
})

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
