/** Shadow Mind deployment and user-settings schemas. @module @whutzefengxie-ops/dsh-shadow-mind/config */
import type Schema from '@deepseek-ai/schemastery';
import type { ShadowMindConfig, ShadowMindSettings } from './types.ts';
/** Default probability of evaluating Shadows after an eligible root turn. */
export declare const DEFAULT_HEARTBEAT_PROBABILITY: number;
/** Default maximum active Shadows per root. */
export declare const DEFAULT_MAX_PARALLEL_SHADOWS = 2;
/** Default per-Shadow deadline in seconds. */
export declare const DEFAULT_SHADOW_TIMEOUT_SECONDS = 300;
/** Default headless convergence deadline in seconds. */
export declare const DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS = 120;
/** Default report batching window. */
export declare const DEFAULT_RESULT_BATCH_WINDOW_MS = 400;
/** Default maximum framed prompt size. */
export declare const DEFAULT_MAX_PROMPT_CHARS = 120000;
/** Default maximum accepted report size. */
export declare const DEFAULT_MAX_REPORT_CHARS = 20000;
/** User-editable Shadow Mind settings schema. */
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
