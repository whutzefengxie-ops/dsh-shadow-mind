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
  /** Whether completed runs append local diagnostic records. */
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
  /** Whether completed runs append local diagnostic records. */
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
  /** Shadow definition id. */
  readonly shadowId: string
  /** Child session id when the provider has published it. */
  readonly childSessionId?: SessionId
  /** Session sequence captured for the prompt. */
  readonly capturedThroughSeq: number
}

/** User-facing terminal classification for one admitted Shadow run. */
export type ShadowRunOutcome = 'report' | 'silent' | 'not_relevant' | 'discarded' | 'failed'

/** Most recently finished Shadow run for one root. */
export interface LastShadowRunStatus {
  /** Shadow definition id. */
  readonly shadowId: string
  /** Child session id when the provider published it. */
  readonly childSessionId?: SessionId
  /** Session sequence captured for the prompt. */
  readonly capturedThroughSeq: number
  /** Completion time in ISO 8601 format. */
  readonly finishedAt: string
  /** Whether the run reported, stayed silent, was discarded, or failed. */
  readonly outcome: ShadowRunOutcome
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
