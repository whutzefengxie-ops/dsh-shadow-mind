/** Shadow Mind deployment and user-settings schemas. @module @whutzefengxie-ops/dsh-shadow-mind/config */
import type Schema from '@deepseek-ai/schemastery';
import { type ShadowMindConfig, type ShadowMindSettings } from './types.ts';
/** Default per-turn activation probability of the single Shadow reviewer. */
export declare const DEFAULT_ACTIVATION_PROBABILITY = 0.7;
/** Default per-Shadow deadline in seconds (10 minutes: deep reviews frequently exceed the old 5-minute budget). */
export declare const DEFAULT_SHADOW_TIMEOUT_SECONDS = 600;
/** Default headless convergence deadline in seconds. */
export declare const DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS = 120;
/** Default report batching window. */
export declare const DEFAULT_RESULT_BATCH_WINDOW_MS = 400;
/** Default maximum framed prompt size; 0 disables the limit. */
export declare const DEFAULT_MAX_PROMPT_CHARS = 0;
/** Default maximum accepted report size; 0 disables the limit. */
export declare const DEFAULT_MAX_REPORT_CHARS = 0;
/** Default root-turn observation window for challenge outcomes. */
export declare const DEFAULT_VALUE_LOOP_WINDOW_TURNS = 2;
/** Default accepted-entry retention per root. */
export declare const DEFAULT_REVIEW_WINDOW_SIZE = 8;
/** Default identical-envelope repeat count. */
export declare const DEFAULT_SPINNING_REPEAT_COUNT = 3;
/** Default alternating verdict period count. */
export declare const DEFAULT_OSCILLATION_PERIODS = 2;
/** Default unchanged confirmation repeat count. */
export declare const DEFAULT_NO_DRIFT_REPEAT_COUNT = 3;
/** Default diminishing-novelty suffix length. */
export declare const DEFAULT_DIMINISHING_WINDOW_SIZE = 5;
/** Default minimum novel-envelope share. */
export declare const DEFAULT_DIMINISHING_NOVELTY_THRESHOLD = 0.4;
/** Default wall-clock stagnation cooldown in seconds. */
export declare const DEFAULT_STAGNATION_COOLDOWN_SECONDS = 300;
/**
 * User-editable settings plus cross-field healing. Availability first: an
 * inconsistent advanced combination degrades to a usable default instead of
 * throwing, so leftover or half-edited values can never brick the plugin.
 */
export declare const SHADOW_MIND_SETTINGS_SCHEMA: Schema<ShadowMindSettings>;
/** Cordis plugin configuration schema. */
export declare const Config: Schema<ShadowMindConfig>;
/**
 * Resolve and validate settings without retaining caller aliases.
 * @param config Deployment configuration and optional settings base.
 * @returns Complete validated settings.
 */
export declare function resolveSettings(config?: ShadowMindConfig): ShadowMindSettings;
/**
 * Extract only settings fields supplied by plugin configuration.
 * @param config Deployment configuration.
 * @returns User-setting base without the Harness home override.
 */
export declare function settingsBase(config: ShadowMindConfig): Partial<ShadowMindSettings>;
