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
/** Default maximum framed prompt size; 0 disables the limit. */
export const DEFAULT_MAX_PROMPT_CHARS = 0
/** Default maximum accepted report size; 0 disables the limit. */
export const DEFAULT_MAX_REPORT_CHARS = 0
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

/** Default gate judge deadline in seconds. */
export const DEFAULT_COMMAND_GATE_JUDGE_TIMEOUT_SECONDS = 30
/** Default gate judge concurrency. */
export const DEFAULT_COMMAND_GATE_MAX_PARALLEL = 1
/** Default identical-command verdict reuse window in seconds. */
export const DEFAULT_COMMAND_GATE_VERDICT_TTL_SECONDS = 120

/** Commands matching one of these are denied before any judge runs. */
export const DEFAULT_COMMAND_GATE_DENY_PATTERNS: readonly string[] = [
  // Process and service termination: the primary production-protection class.
  // Cmdlet names match anywhere so chained kills still fail closed.
  '\\bStop-Process\\b',
  '\\bStop-Service\\b',
  '\\bRestart-Service\\b',
  '\\bSuspend-Service\\b',
  // Aliased or host-level killers match at COMMAND position only, so
  // arguments like `git log --grep kill` or `Get-Content kill.log` pass.
  '(?:^|[;&|\\n])\\s*taskkill(?:\\.exe)?\\b',
  '(?:^|[;&|\\n])\\s*kill(?:all)?\\b',
  '(?:^|[;&|\\n])\\s*shutdown(?:\\.exe)?\\b',
  // Host and session shutdown.
  '\\bStop-Computer\\b',
  '\\bRestart-Computer\\b',
  '\\bStop-VM\\b',
  // Irreversible storage operations. Format-Volume is enumerated rather than
  // `Format-\w+` so read-only Format-List/Format-Table/Format-Hex still run.
  '\\bFormat-Volume\\b',
  '\\bClear-Disk\\b',
  '\\bRemove-Item\\b[\\s\\S]*\\b-Recurse\\b',
  '\\brm\\s+(-[a-zA-Z]*r[a-zA-Z]*|-r|--recursive)\\b',
  // Registry and credential destruction.
  '\\bRemove-ItemProperty\\b',
  '\\breg\\s+delete\\b',
  '\\bUninstall-Package\\b',
]

/**
 * Pure-read commands allowed without a judge when no deny pattern matches.
 * A command containing a shell separator (`;`, `&`, `|`, backtick, newline)
 * never qualifies: prefix matching must not bless `git status; <anything>`.
 */
export const DEFAULT_COMMAND_GATE_ALLOW_PATTERNS: readonly string[] = [
  '^(Get-|Select-|Where-|Measure-|Compare-|Format-List|Format-Table|Write-Output|Write-Host|echo|pwd|ls|dir|cat|type)\\b',
  '^\\s*(gci|gl|gp|gm|gsv|gps|history|alias)\\b',
  '^\\s*(git|gh)\\s+(status|diff|log|show|remote|ls-files|config)\\b',
  // git branch is read-only only with listing/showing flags; -D/-d/-m delete
  // or rename branches and fall through to the judge.
  '^\\s*git\\s+branch\\s*(?:-{1,2}(?:a|all|r|remotes|list|show-current|v|vv|verbose|merged|no-merged|contains|no-contains)\\b\\s*)*$',
  '^\\s*node\\s+(-v|--version)\\s*$',
  '^\\s*(npm|pnpm|yarn)\\s+(-v|--version)\\s*$',
  '^\\s*(npm|pnpm|yarn)\\s+(?:list|ls)\\b',
  '^\\s*(dotnet|java|python|py|go|rustc|cargo)\\s+--?v(?:ersion)?\\s*$',
  '^\\s*(where|which|whereis)\\b',
  '^\\s*\\$?(env|PATH|PSVersionTable|Host)\\b',
  '^\\s*Test-Path\\b',
]

/** Shell separators that disqualify a Tier-1 read-only allowance. */
export const COMMAND_GATE_SEPARATOR_PATTERN = /[;&|`\r\n]/u

/** User-editable Shadow Mind settings schema. */
const SHADOW_MIND_SETTINGS_OBJECT = z.object({
  heartbeatProbability: z.number().min(0).max(1).default(DEFAULT_HEARTBEAT_PROBABILITY),
  maxParallelShadows: z.number().step(1).min(1).default(DEFAULT_MAX_PARALLEL_SHADOWS),
  defaultShadowTimeoutSeconds: z.number().min(0.001).default(DEFAULT_SHADOW_TIMEOUT_SECONDS),
  headlessDrainTimeoutSeconds: z.number().min(0.001).default(DEFAULT_HEADLESS_DRAIN_TIMEOUT_SECONDS),
  resultBatchWindowMs: z.number().min(0).default(DEFAULT_RESULT_BATCH_WINDOW_MS),
  defaultShadowModel: z.string().pattern(SHADOW_MODEL_ROUTE_PATTERN),
  defaultReasoningEffort: z.string(),
  synthesisModel: z.string().pattern(SHADOW_MODEL_ROUTE_PATTERN),
  synthesisReasoningEffort: z.string(),
  argumentDisclosure: z.union(['redacted', 'full'] as const).default('redacted'),
  randomSeed: z.number(),
  maxPromptChars: z.number().step(1).min(0).default(DEFAULT_MAX_PROMPT_CHARS),
  maxReportChars: z.number().step(1).min(0).default(DEFAULT_MAX_REPORT_CHARS),
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
  commandGateEnabled: z.boolean().default(false),
  commandGateTools: z.array(z.string()).default(['pwsh']),
  commandGateScope: z.union(['root-only', 'root-and-subagents'] as const).default('root-only'),
  commandGateDenyPatterns: z.array(z.string()).default([...DEFAULT_COMMAND_GATE_DENY_PATTERNS]),
  commandGateAllowPatterns: z.array(z.string()).default([...DEFAULT_COMMAND_GATE_ALLOW_PATTERNS]),
  commandGateProtectedProcesses: z.array(z.string()).default([]),
  commandGateProtectedServices: z.array(z.string()).default([]),
  commandGateContext: z.string(),
  commandGateModel: z.string().pattern(SHADOW_MODEL_ROUTE_PATTERN),
  commandGateReasoningEffort: z.string(),
  commandGateJudgeTimeoutSeconds: z.number().min(0.001).default(DEFAULT_COMMAND_GATE_JUDGE_TIMEOUT_SECONDS),
  commandGateOnJudgeFailure: z.union(['deny', 'allow'] as const).default('deny'),
  commandGateMaxParallel: z.number().step(1).min(1).default(DEFAULT_COMMAND_GATE_MAX_PARALLEL),
  commandGateVerdictTtlSeconds: z.number().min(0).default(DEFAULT_COMMAND_GATE_VERDICT_TTL_SECONDS),
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
