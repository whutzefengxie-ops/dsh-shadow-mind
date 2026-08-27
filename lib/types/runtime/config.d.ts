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
/** Default result size that activates the long-output review boost. */
export declare const DEFAULT_LONG_OUTPUT_BOOST_CHARS = 50000;
/** Default identical-envelope count required for last-report suppression. */
export declare const DEFAULT_LAST_REPORT_COVERS_COUNT = 2;
/** Default same-tool failure count required for a review boost. */
export declare const DEFAULT_REPEATED_FAILURE_BOOST_THRESHOLD = 3;
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
/** Default gate judge deadline in seconds. */
export declare const DEFAULT_COMMAND_GATE_JUDGE_TIMEOUT_SECONDS = 30;
/** Default gate judge concurrency. */
export declare const DEFAULT_COMMAND_GATE_MAX_PARALLEL = 1;
/** Default identical-command verdict reuse window in seconds. */
export declare const DEFAULT_COMMAND_GATE_VERDICT_TTL_SECONDS = 120;
/** Commands matching one of these are denied before any judge runs. */
export declare const DEFAULT_COMMAND_GATE_DENY_PATTERNS: readonly string[];
/**
 * Pure-read commands allowed without a judge when no deny pattern matches.
 * A command containing a shell separator (`;`, `&`, `|`, backtick, newline)
 * never qualifies: prefix matching must not bless `git status; <anything>`.
 */
export declare const DEFAULT_COMMAND_GATE_ALLOW_PATTERNS: readonly string[];
/** Shell separators that disqualify a Tier-1 read-only allowance. */
export declare const COMMAND_GATE_SEPARATOR_PATTERN: RegExp;
/** User-editable settings plus cross-field budget and window validation. */
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
