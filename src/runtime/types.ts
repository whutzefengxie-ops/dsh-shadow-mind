/** Public Shadow Mind definition, settings, catalog, and status types. @module @whutzefengxie-ops/dsh-shadow-mind/types */

import type { SessionId } from '@deepseek-ai/dsh-session'

/** One validated Markdown-backed Shadow definition. */
export interface ShadowDefinition {
  /** Stable lowercase identifier. */
  readonly id: string
  /** Human-readable name used in reports and diagnostics. */
  readonly name: string
  /** Whether scheduling may select this Shadow. */
  readonly enabled: boolean
  /** Whether lifecycle transitions append local diagnostic records. */
  readonly debug: boolean
  /** Independent activation probability after the heartbeat gate passes. */
  readonly activationProbability: number
  /** Optional model globs that make this Shadow eligible. */
  readonly activeForModels: readonly string[]
  /** Optional `provider/model` route for this Shadow run. */
  readonly runWithModel?: string
  /** Optional adapter-owned reasoning effort for this Shadow run. */
  readonly reasoningEffort?: string
  /** Optional run deadline in seconds. */
  readonly timeoutSeconds?: number
  /** Explicit tools added to the default read-only set. */
  readonly tools: readonly string[]
  /** Shadow-specific instructions from the Markdown body. */
  readonly prompt: string
  /** Absolute source Markdown path. */
  readonly sourcePath: string
}

/** One definition file that could not join the active catalog. */
export interface ShadowDiagnostic {
  /** Absolute source path. */
  readonly path: string
  /** Stable human-readable parse, validation, or duplicate-id error. */
  readonly error: string
}

/** Fresh catalog snapshot loaded from disk. */
export interface ShadowCatalog {
  /** Valid definitions, sorted by source path and deduplicated by id. */
  readonly definitions: readonly ShadowDefinition[]
  /** File-local failures that did not hide other valid definitions. */
  readonly diagnostics: readonly ShadowDiagnostic[]
}

/** Catalog snapshot served to the trusted Web administration page. */
export interface ShadowAdministrationSnapshot extends ShadowCatalog {
  /** Directory containing the Markdown definition files. */
  readonly definitionRoot: string
}

/** Complete editable definition submitted by the Web administration page. */
export interface ShadowDefinitionInput {
  /** Stable lowercase identifier. */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** Whether automatic scheduling may select this Shadow. */
  readonly enabled: boolean
  /** Whether lifecycle transitions append local diagnostic records. */
  readonly debug: boolean
  /** Independent activation probability from zero through one. */
  readonly activationProbability: number
  /** Model or provider/model globs that make this Shadow eligible. */
  readonly activeForModels: readonly string[]
  /** Execution route, or null to inherit the runtime default. */
  readonly runWithModel: string | null
  /** Adapter-owned reasoning effort, or null to inherit the runtime default. */
  readonly reasoningEffort: string | null
  /** Per-run deadline, or null to inherit the runtime default. */
  readonly timeoutSeconds: number | null
  /** Tools added to the default Shadow allowlist. */
  readonly tools: readonly string[]
  /** Non-empty Shadow instructions. */
  readonly prompt: string
}

/** Live scheduling and projection settings owned by the user. */
export interface ShadowMindSettings {
  /** Probability that an eligible tool-using root turn enters Shadow scheduling. */
  readonly heartbeatProbability: number
  /** Maximum active Shadow runs per root agent. */
  readonly maxParallelShadows: number
  /** Default run deadline when a definition omits one. */
  readonly defaultShadowTimeoutSeconds: number
  /** Maximum headless wait after a root turn. */
  readonly headlessDrainTimeoutSeconds: number
  /** Window used to combine accepted reports into one relay. */
  readonly resultBatchWindowMs: number
  /** Optional fallback `provider/model` route. */
  readonly defaultShadowModel?: string
  /** Optional fallback adapter-owned reasoning effort. */
  readonly defaultReasoningEffort?: string
  /** Whether tool-call arguments are omitted or copied into Shadow prompts. */
  readonly argumentDisclosure: 'redacted' | 'full'
  /** Optional deterministic random seed. */
  readonly randomSeed?: number
  /** Maximum complete framed prompt size. */
  readonly maxPromptChars: number
  /** Maximum accepted report size. */
  readonly maxReportChars: number
}

/** Runtime plugin configuration. */
export interface ShadowMindConfig extends Partial<ShadowMindSettings> {
  /** Harness home used for definitions and debug logs. */
  readonly dshHome?: string
}

/** Authoring fields accepted when creating a definition. */
export type CreateShadowDefinition = Omit<ShadowDefinition, 'sourcePath'>

/** Mutable definition fields accepted by an update; explicit undefined clears optional execution overrides. */
export type UpdateShadowDefinition = Partial<Omit<
  CreateShadowDefinition,
  'id' | 'runWithModel' | 'reasoningEffort' | 'timeoutSeconds'
>> & {
  readonly runWithModel?: string | undefined
  readonly reasoningEffort?: string | undefined
  readonly timeoutSeconds?: number | undefined
}

/** One active Shadow run shown in runtime status. */
export interface ActiveShadowStatus {
  /** Runtime-generated run id. */
  readonly runId: string
  /** Shadow definition id. */
  readonly shadowId: string
  /** Shadow display name. */
  readonly shadowName: string
  /** Child session id when the provider has published it. */
  readonly childSessionId?: SessionId
  /** Session sequence captured for the prompt. */
  readonly capturedThroughSeq: number
  /** Current execution stage. */
  readonly stage: ShadowRunStage
}

/** User-facing terminal classification for one admitted Shadow run. */
export type ShadowRunOutcome = 'report' | 'silent' | 'not_relevant' | 'aborted' | 'failed'

/** Runtime phase displayed by the conversation card. */
export type ShadowRunPhase = 'running' | ShadowRunOutcome

/** Stage at which one run is active or stopped. */
export type ShadowRunStage = 'prepare' | 'start' | 'run' | 'dispose' | 'validate' | 'relay'

/** Stable machine-readable explanation for cancellation or failure. */
export type ShadowRunReasonCode =
  | 'USER_MESSAGE_RECEIVED'
  | 'USER_TURN_ABORTED'
  | 'SHADOW_PAUSED'
  | 'ROOT_DISPOSED'
  | 'PLUGIN_DISPOSED'
  | 'SHADOW_TIMEOUT'
  | 'HEADLESS_DRAIN_TIMEOUT'
  | 'HEADLESS_MAINTENANCE_ABORTED'
  | 'STALE_EPOCH'
  | 'PROVIDER_ABORTED'
  | 'SCHEDULING_FAILED'
  | 'TRAJECTORY_BUILD_FAILED'
  | 'MODEL_SELECTION_INVALID'
  | 'SUBAGENT_START_FAILED'
  | 'SUBAGENT_RESULT_FAILED'
  | 'SUBAGENT_DISPOSE_FAILED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_MAX_TOKENS'
  | 'PROVIDER_REFUSAL'
  | 'PROVIDER_STOPPED'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'INVALID_REPORT'
  | 'REPORT_DELIVERY_FAILED'
  | 'UNKNOWN_FAILURE'

/** Actor or lifecycle source that requested cancellation. */
export type ShadowCancellationSource =
  | 'user-input'
  | 'user-command'
  | 'root-lifecycle'
  | 'plugin-lifecycle'
  | 'timeout'
  | 'headless'
  | 'provider'
  | 'runtime'

/** Redacted error fields safe for Remote responses and debug JSONL. */
export interface ShadowSafeError {
  /** JavaScript error class name. */
  readonly name: string
  /** Length-bounded message with credentials and absolute paths removed. */
  readonly message: string
  /** Optional platform or provider error code. */
  readonly code?: string
  /** Redacted nested error causes. */
  readonly causes?: readonly ShadowSafeError[]
}

/** One Shadow run as exposed to the browser without model inputs or credentials. */
export interface ShadowRunView {
  /** Runtime-generated run id. */
  readonly runId: string
  /** Shadow definition id. */
  readonly shadowId: string
  /** Shadow display name. */
  readonly shadowName: string
  /** Session sequence captured for the prompt. */
  readonly capturedThroughSeq: number
  /** Current or terminal phase. */
  readonly phase: ShadowRunPhase
  /** Current or terminal execution stage. */
  readonly stage: ShadowRunStage
  /** Admission time in ISO 8601 format. */
  readonly startedAt: string
  /** Child session id when the provider has published it. */
  readonly childSessionId?: SessionId
  /** Terminal time in ISO 8601 format. */
  readonly finishedAt?: string
  /** Stable cancellation or failure explanation. */
  readonly reasonCode?: ShadowRunReasonCode
  /** Cancellation initiator when applicable. */
  readonly cancellationSource?: ShadowCancellationSource
  /** Provider-owned terminal classification. */
  readonly providerStopReason?: string
  /** Redacted failure detail. */
  readonly error?: ShadowSafeError
  /** Validated report Markdown while delivery is pending or complete. */
  readonly content?: string
  /** Whether a report reached the root inbox. */
  readonly relayed?: boolean
}

/** Scheduling failure before any definition could be admitted. */
export interface ShadowReviewCycleFailure {
  readonly reasonCode: 'SCHEDULING_FAILED'
  readonly stage: 'prepare'
  readonly error: ShadowSafeError
}

/** Browser snapshot for the review opportunity attached to one root turn. */
export interface ShadowReviewCycle {
  /** Root event sequence that anchors the card. */
  readonly capturedThroughSeq: number
  /** Whether definition loading and selection are unsettled. */
  readonly scheduling: boolean
  /** Admitted runs in launch order. */
  readonly runs: readonly ShadowRunView[]
  /** Scheduling failure when no run could be selected safely. */
  readonly failure?: ShadowReviewCycleFailure
}

/** Most recently finished Shadow run for one root. */
export interface LastShadowRunStatus {
  /** Runtime-generated run id. */
  readonly runId: string
  /** Shadow definition id. */
  readonly shadowId: string
  /** Shadow display name. */
  readonly shadowName: string
  /** Child session id when the provider published it. */
  readonly childSessionId?: SessionId
  /** Session sequence captured for the prompt. */
  readonly capturedThroughSeq: number
  /** Completion time in ISO 8601 format. */
  readonly finishedAt: string
  /** Whether the run reported, stayed silent, was irrelevant, was aborted, or failed. */
  readonly outcome: ShadowRunOutcome
  /** Stage at which the terminal outcome was decided. */
  readonly stage: ShadowRunStage
  /** Stable cancellation or failure explanation. */
  readonly reasonCode?: ShadowRunReasonCode
  /** Cancellation initiator when applicable. */
  readonly cancellationSource?: ShadowCancellationSource
  /** Provider-owned terminal classification. */
  readonly providerStopReason?: string
  /** Redacted failure detail. */
  readonly error?: ShadowSafeError
}

/** Per-root runtime status. */
export interface ShadowMindStatus {
  /** Whether automatic scheduling is paused. */
  readonly paused: boolean
  /** Active runs in start order. */
  readonly active: readonly ActiveShadowStatus[]
  /** Number of turn schedules still loading or admitting work. */
  readonly pendingSchedules: number
  /** Current cancellation epoch. */
  readonly epoch: number
  /** Number of Shadow runs admitted during this root's process lifetime. */
  readonly totalRuns: number
  /** Most recently finished run during this root's process lifetime. */
  readonly lastRun?: LastShadowRunStatus
}
