/** Public Shadow Mind definition, settings, catalog, and status types. @module @whutzefengxie-ops/dsh-shadow-mind/types */
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { ShadowModelCatalog } from './model-catalog.ts';
export type { ShadowCatalogModel, ShadowModelCatalog, ShadowModelEffort, ShadowModelFailure, ShadowModelGroup, ShadowModelReasoning, } from './model-catalog.ts';
/** Epistemic classification carried by an accepted Shadow finding. */
export type ShadowVerdict = 'challenge' | 'gap' | 'confirm' | 'uncertain';
/** Honest relationship between the root and reviewer model vendors. */
export type ShadowIndependence = 'independent' | 'unverified' | 'unavailable' | 'same_vendor';
/** One validated Markdown-backed Shadow definition. */
export interface ShadowDefinition {
    /** Stable lowercase identifier. */
    readonly id: string;
    /** Human-readable name used in reports and diagnostics. */
    readonly name: string;
    /** Whether scheduling may select this Shadow. */
    readonly enabled: boolean;
    /** Whether lifecycle transitions append local diagnostic records. */
    readonly debug: boolean;
    /** Independent activation probability after the heartbeat gate passes. */
    readonly activationProbability: number;
    /** Optional model globs that make this Shadow eligible. */
    readonly activeForModels: readonly string[];
    /** Optional `provider/model` route for this Shadow run. */
    readonly runWithModel?: string;
    /** Optional adapter-owned reasoning effort for this Shadow run. */
    readonly reasoningEffort?: string;
    /** Optional run deadline in seconds. */
    readonly timeoutSeconds?: number;
    /** Explicit tools added to the default read-only set. */
    readonly tools: readonly string[];
    /** Root-log range projected into each run. */
    readonly capture: 'full' | 'since-compaction';
    /** Whether ordinary child runtime context and pre-step injections are inherited. */
    readonly context: 'standard' | 'minimal';
    /** Whether the child plans against numbered anchors before tools become visible. */
    readonly thinkFirst: boolean;
    /** Named deterministic predicates that skip a selected run. */
    readonly preFilters: readonly string[];
    /** Named deterministic predicates that raise activation probability. */
    readonly boostFilters: readonly string[];
    /** Multiplier applied when any configured boost predicate matches. */
    readonly boostFactor: number;
    /** Whether protected sidecar literals must be redacted from this run. */
    readonly holdout: boolean;
    /** Shadow-specific instructions from the Markdown body. */
    readonly prompt: string;
    /** Absolute source Markdown path. */
    readonly sourcePath: string;
}
/** One definition file that could not join the active catalog. */
export interface ShadowDiagnostic {
    /** Absolute source path. */
    readonly path: string;
    /** Stable human-readable parse, validation, or duplicate-id error. */
    readonly error: string;
}
/** Fresh catalog snapshot loaded from disk. */
export interface ShadowCatalog {
    /** Valid definitions, sorted by source path and deduplicated by id. */
    readonly definitions: readonly ShadowDefinition[];
    /** File-local failures that did not hide other valid definitions. */
    readonly diagnostics: readonly ShadowDiagnostic[];
}
/** Catalog snapshot served to the trusted Web administration page. */
export interface ShadowAdministrationSnapshot extends ShadowCatalog {
    /** Directory containing the Markdown definition files. */
    readonly definitionRoot: string;
    /** Live DSH provider/model/effort directory plus the agent-preset roster. */
    readonly modelCatalog: ShadowModelCatalog;
}
/** Complete editable definition submitted by the Web administration page. */
export interface ShadowDefinitionInput {
    /** Stable lowercase identifier. */
    readonly id: string;
    /** Human-readable name. */
    readonly name: string;
    /** Whether automatic scheduling may select this Shadow. */
    readonly enabled: boolean;
    /** Whether completed runs append local diagnostic records. */
    readonly debug: boolean;
    /** Independent activation probability from zero through one. */
    readonly activationProbability: number;
    /** Model or provider/model globs that make this Shadow eligible. */
    readonly activeForModels: readonly string[];
    /** Execution route, or null to inherit the runtime default. */
    readonly runWithModel: string | null;
    /** Adapter-owned reasoning effort, or null to inherit the runtime default. */
    readonly reasoningEffort: string | null;
    /** Per-run deadline, or null to inherit the runtime default. */
    readonly timeoutSeconds: number | null;
    /** Tools added to the default Shadow allowlist. */
    readonly tools: readonly string[];
    /** Root-log range projected into each run. */
    readonly capture: 'full' | 'since-compaction';
    /** Whether ordinary child runtime context and pre-step injections are inherited. */
    readonly context: 'standard' | 'minimal';
    /** Whether the child plans against numbered anchors before tools become visible. */
    readonly thinkFirst: boolean;
    /** Named deterministic predicates that skip a selected run. */
    readonly preFilters: readonly string[];
    /** Named deterministic predicates that raise activation probability. */
    readonly boostFilters: readonly string[];
    /** Multiplier applied when any configured boost predicate matches. */
    readonly boostFactor: number;
    /** Whether protected sidecar literals must be redacted from this run. */
    readonly holdout: boolean;
    /** Non-empty Shadow instructions. */
    readonly prompt: string;
}
/** Live scheduling and projection settings owned by the user. */
export interface ShadowMindSettings {
    /** Probability that an eligible tool-using root turn enters Shadow scheduling. */
    readonly heartbeatProbability: number;
    /** Maximum active Shadow runs per root agent. */
    readonly maxParallelShadows: number;
    /** Default run deadline when a definition omits one. */
    readonly defaultShadowTimeoutSeconds: number;
    /** Maximum headless wait after a root turn. */
    readonly headlessDrainTimeoutSeconds: number;
    /** Window used to combine accepted reports into one relay. */
    readonly resultBatchWindowMs: number;
    /** Optional fallback `provider/model` route. */
    readonly defaultShadowModel?: string;
    /** Optional fallback adapter-owned reasoning effort. */
    readonly defaultReasoningEffort?: string;
    /** Optional provider/model route for conflict-synthesis runs. */
    readonly synthesisModel?: string;
    /** Optional adapter-owned reasoning effort for conflict-synthesis runs. */
    readonly synthesisReasoningEffort?: string;
    /** Whether tool-call arguments are omitted or copied into Shadow prompts. */
    readonly argumentDisclosure: 'redacted' | 'full';
    /** Optional deterministic random seed. */
    readonly randomSeed?: number;
    /** Maximum complete framed prompt size. */
    readonly maxPromptChars: number;
    /** Maximum accepted report size. */
    readonly maxReportChars: number;
    /** Prefer positively independent reviewer vendors without collapsing the candidate jury. */
    readonly preferIndependentVendor: boolean;
    /** Durable tool-result character count that activates the `long-output` boost predicate. */
    readonly longOutputBoostChars: number;
    /** Consecutive identical report envelopes required by `last-report-covers`. */
    readonly lastReportCoversCount: number;
    /** Same-tool failures in one turn required by `repeated-failure`. */
    readonly repeatedFailureBoostThreshold: number;
    /** Whether accepted challenges are classified against later root behavior. */
    readonly valueLoopEnabled: boolean;
    /** Completed root turns observed before an unanswered challenge becomes ignored. */
    readonly valueLoopWindowTurns: number;
    /** Accepted entries retained for stagnation and novelty analysis. */
    readonly reviewWindowSize: number;
    /** Consecutive identical envelopes required for spinning detection. */
    readonly spinningRepeatCount: number;
    /** Alternating verdict periods required for oscillation detection. */
    readonly oscillationPeriods: number;
    /** Consecutive unchanged confirmations required for no-drift detection. */
    readonly noDriftRepeatCount: number;
    /** Suffix length used by diminishing-novelty detection. */
    readonly diminishingWindowSize: number;
    /** Novel envelope share below which a full suffix is diminishing. */
    readonly diminishingNoveltyThreshold: number;
    /** Wall-clock duration applied to a detected definition. */
    readonly stagnationCooldownSeconds: number;
    /** Whether oscillation may spend the next reasoning-effort rung instead of cooling down. */
    readonly stagnationEscalationEnabled: boolean;
    /** Ordered adapter-owned reasoning effort ids used for one-rung escalation. */
    readonly reasoningEffortLadder: readonly string[];
    /** Optional character spend that activates the frugal route. */
    readonly sessionShadowSoftBudgetChars?: number;
    /** Optional character spend that stops new Shadow runs. */
    readonly sessionShadowHardBudgetChars?: number;
    /** Optional provider/model route used after the soft budget. */
    readonly frugalShadowModel?: string;
    /** Multiplicative probability decay for repeated report envelopes. */
    readonly staleReportDecay: number;
    /** Whether one conflicting challenge/confirm pair may invoke a synthesizer. */
    readonly conflictSynthesisEnabled: boolean;
    /** Deadline for the additional conflict-synthesis run. */
    readonly conflictSynthesisTimeoutSeconds: number;
    /** Whether pwsh-style commands from the root agent pass through the gate. */
    readonly commandGateEnabled: boolean;
    /** Tool names the gate intercepts. */
    readonly commandGateTools: readonly string[];
    /** Which agents the gate inspects; children never re-gate their own judges. */
    readonly commandGateScope: 'root-only' | 'root-and-subagents';
    /** Regular expressions that deny a command deterministically, before any judge. */
    readonly commandGateDenyPatterns: readonly string[];
    /** Regular expressions that allow a command deterministically when no deny pattern matches. */
    readonly commandGateAllowPatterns: readonly string[];
    /** Process names the user declares protected; a destructive command naming one is denied. */
    readonly commandGateProtectedProcesses: readonly string[];
    /** Service names the user declares protected; a destructive command naming one is denied. */
    readonly commandGateProtectedServices: readonly string[];
    /** Free-text environment declaration injected into every gate judge prompt. */
    readonly commandGateContext?: string;
    /** Optional provider/model route for the gate judge. */
    readonly commandGateModel?: string;
    /** Optional adapter-owned reasoning effort for the gate judge. */
    readonly commandGateReasoningEffort?: string;
    /** Deadline for one gate judge verdict in seconds. */
    readonly commandGateJudgeTimeoutSeconds: number;
    /** Outcome when the judge times out or fails: fail closed or fail open. */
    readonly commandGateOnJudgeFailure: 'deny' | 'allow';
    /** Maximum concurrent gate judges; surplus commands queue behind the first. */
    readonly commandGateMaxParallel: number;
    /** Seconds an identical (agent, command) reuses the previous judge verdict. */
    readonly commandGateVerdictTtlSeconds: number;
}
/** Partial live-settings write; null removes one optional user override. */
export type UpdateShadowMindSettings = Partial<Omit<ShadowMindSettings, 'defaultShadowModel' | 'defaultReasoningEffort' | 'randomSeed' | 'sessionShadowSoftBudgetChars' | 'sessionShadowHardBudgetChars' | 'frugalShadowModel' | 'synthesisModel' | 'synthesisReasoningEffort' | 'commandGateContext' | 'commandGateModel' | 'commandGateReasoningEffort'>> & {
    readonly defaultShadowModel?: string | null;
    readonly defaultReasoningEffort?: string | null;
    readonly randomSeed?: number | null;
    readonly sessionShadowSoftBudgetChars?: number | null;
    readonly sessionShadowHardBudgetChars?: number | null;
    readonly frugalShadowModel?: string | null;
    readonly synthesisModel?: string | null;
    readonly synthesisReasoningEffort?: string | null;
    readonly commandGateContext?: string | null;
    readonly commandGateModel?: string | null;
    readonly commandGateReasoningEffort?: string | null;
};
/** Runtime plugin configuration. */
export interface ShadowMindConfig extends Partial<ShadowMindSettings> {
    /** Harness home used for definitions and debug logs. */
    readonly dshHome?: string;
}
/** Authoring fields accepted when creating a definition; conditioning defaults preserve legacy files and callers. */
export type CreateShadowDefinition = Omit<ShadowDefinition, 'sourcePath' | 'capture' | 'context' | 'thinkFirst' | 'preFilters' | 'boostFilters' | 'boostFactor' | 'holdout'> & Partial<Pick<ShadowDefinition, 'capture' | 'context' | 'thinkFirst' | 'preFilters' | 'boostFilters' | 'boostFactor' | 'holdout'>>;
/** Mutable definition fields accepted by an update; explicit undefined clears optional execution overrides. */
export type UpdateShadowDefinition = Partial<Omit<CreateShadowDefinition, 'id' | 'runWithModel' | 'reasoningEffort' | 'timeoutSeconds'>> & {
    readonly runWithModel?: string | undefined;
    readonly reasoningEffort?: string | undefined;
    readonly timeoutSeconds?: number | undefined;
};
/** One active Shadow run shown in runtime status. */
export interface ActiveShadowStatus {
    /** Runtime-generated run id. */
    readonly runId: string;
    /** Shadow definition id. */
    readonly shadowId: string;
    /** Shadow display name. */
    readonly shadowName: string;
    /** Child session id when the provider has published it. */
    readonly childSessionId?: SessionId;
    /** Session sequence captured for the prompt. */
    readonly capturedThroughSeq: number;
    /** Current execution stage. */
    readonly stage: ShadowRunStage;
}
/** User-facing terminal classification for one admitted Shadow run. */
export type ShadowRunOutcome = 'report' | 'silent' | 'not_relevant' | 'aborted' | 'failed';
/** Runtime phase displayed by the conversation card. */
export type ShadowRunPhase = 'running' | ShadowRunOutcome;
/** Stage at which one run is active or stopped. */
export type ShadowRunStage = 'prepare' | 'start' | 'run' | 'dispose' | 'validate' | 'relay';
/** Stable machine-readable explanation for cancellation or failure. */
export type ShadowRunReasonCode = 'USER_MESSAGE_RECEIVED' | 'USER_TURN_ABORTED' | 'SHADOW_PAUSED' | 'ROOT_DISPOSED' | 'PLUGIN_DISPOSED' | 'SHADOW_TIMEOUT' | 'HEADLESS_DRAIN_TIMEOUT' | 'HEADLESS_MAINTENANCE_ABORTED' | 'STALE_EPOCH' | 'PROVIDER_ABORTED' | 'SCHEDULING_FAILED' | 'TRAJECTORY_BUILD_FAILED' | 'MODEL_SELECTION_INVALID' | 'SUBAGENT_START_FAILED' | 'SUBAGENT_RESULT_FAILED' | 'SUBAGENT_DISPOSE_FAILED' | 'PROVIDER_ERROR' | 'PROVIDER_MAX_TOKENS' | 'PROVIDER_REFUSAL' | 'PROVIDER_STOPPED' | 'INVALID_STRUCTURED_OUTPUT' | 'INVALID_REPORT' | 'REPORT_DELIVERY_FAILED' | 'UNKNOWN_FAILURE';
/** Actor or lifecycle source that requested cancellation. */
export type ShadowCancellationSource = 'user-input' | 'user-command' | 'root-lifecycle' | 'plugin-lifecycle' | 'timeout' | 'headless' | 'provider' | 'runtime';
/** Redacted error fields safe for Remote responses and debug JSONL. */
export interface ShadowSafeError {
    /** JavaScript error class name. */
    readonly name: string;
    /** Length-bounded message with credentials and absolute paths removed. */
    readonly message: string;
    /** Optional platform or provider error code. */
    readonly code?: string;
    /** Redacted nested error causes. */
    readonly causes?: readonly ShadowSafeError[];
}
/** One Shadow run as exposed to the browser without model inputs or credentials. */
export interface ShadowRunView {
    /** Runtime-generated run id. */
    readonly runId: string;
    /** Shadow definition id. */
    readonly shadowId: string;
    /** Shadow display name. */
    readonly shadowName: string;
    /** Session sequence captured for the prompt. */
    readonly capturedThroughSeq: number;
    /** Current or terminal phase. */
    readonly phase: ShadowRunPhase;
    /** Current or terminal execution stage. */
    readonly stage: ShadowRunStage;
    /** Admission time in ISO 8601 format. */
    readonly startedAt: string;
    /** Child session id when the provider has published it. */
    readonly childSessionId?: SessionId;
    /** Terminal time in ISO 8601 format. */
    readonly finishedAt?: string;
    /** Stable cancellation or failure explanation. */
    readonly reasonCode?: ShadowRunReasonCode;
    /** Cancellation initiator when applicable. */
    readonly cancellationSource?: ShadowCancellationSource;
    /** Provider-owned terminal classification. */
    readonly providerStopReason?: string;
    /** Redacted failure detail. */
    readonly error?: ShadowSafeError;
    /** Validated report Markdown while delivery is pending or complete. */
    readonly content?: string;
    /** Whether a report reached the root inbox. */
    readonly relayed?: boolean;
    /** Streamed text and reasoning characters before structured output. */
    readonly deliberationChars?: number;
    /** Verdict of an accepted report. */
    readonly verdict?: ShadowVerdict;
    /** Reviewer-vendor relationship computed from resolved routes. */
    readonly independence?: ShadowIndependence;
    /** Resolved provider/model route used by the run. */
    readonly route?: string;
}
/** Scheduling failure before any definition could be admitted. */
export interface ShadowReviewCycleFailure {
    readonly reasonCode: 'SCHEDULING_FAILED';
    readonly stage: 'prepare';
    readonly error: ShadowSafeError;
}
/** Browser snapshot for the review opportunity attached to one root turn. */
export interface ShadowReviewCycle {
    /** Root event sequence that anchors the card. */
    readonly capturedThroughSeq: number;
    /** Whether definition loading and selection are unsettled. */
    readonly scheduling: boolean;
    /** Admitted runs in launch order. */
    readonly runs: readonly ShadowRunView[];
    /** Scheduling failure when no run could be selected safely. */
    readonly failure?: ShadowReviewCycleFailure;
}
/** Most recently finished Shadow run for one root. */
export interface LastShadowRunStatus {
    /** Runtime-generated run id. */
    readonly runId: string;
    /** Shadow definition id. */
    readonly shadowId: string;
    /** Shadow display name. */
    readonly shadowName: string;
    /** Child session id when the provider published it. */
    readonly childSessionId?: SessionId;
    /** Session sequence captured for the prompt. */
    readonly capturedThroughSeq: number;
    /** Completion time in ISO 8601 format. */
    readonly finishedAt: string;
    /** Whether the run reported, stayed silent, was irrelevant, was aborted, or failed. */
    readonly outcome: ShadowRunOutcome;
    /** Stage at which the terminal outcome was decided. */
    readonly stage: ShadowRunStage;
    /** Stable cancellation or failure explanation. */
    readonly reasonCode?: ShadowRunReasonCode;
    /** Cancellation initiator when applicable. */
    readonly cancellationSource?: ShadowCancellationSource;
    /** Provider-owned terminal classification. */
    readonly providerStopReason?: string;
    /** Redacted failure detail. */
    readonly error?: ShadowSafeError;
    /** Streamed text and reasoning characters before structured output. */
    readonly deliberationChars: number;
    /** Verdict of an accepted report. */
    readonly verdict?: ShadowVerdict;
    /** Reviewer-vendor relationship computed from resolved routes. */
    readonly independence: ShadowIndependence;
    /** Resolved provider/model route used by the run. */
    readonly route?: string;
}
/** Last computed activation probability for one definition. */
export interface ShadowEffectiveProbability {
    /** Definition whose effective probability was computed. */
    readonly shadowId: string;
    /** Probability after deterministic boosts and decay. */
    readonly probability: number;
}
/** Diagnostic value-loop counters for one definition. */
export interface ShadowValueLoopStatus {
    /** Shadow definition id. */
    readonly shadowId: string;
    /** Accepted challenge reports observed during this process lifetime. */
    readonly challenges: number;
    /** Challenges followed by root action or explicit adoption. */
    readonly adopted: number;
    /** Challenges explicitly rejected by the root. */
    readonly rejected: number;
    /** Challenges unanswered through the configured observation window. */
    readonly ignored: number;
    /** Adopted share among challenges that received an explicit disposition. */
    readonly hitRate?: number;
}
/** One active wall-clock cooldown visible in runtime status. */
export interface ShadowCooldownStatus {
    /** Definition suppressed until expiry. */
    readonly shadowId: string;
    /** ISO 8601 wall-clock expiry. */
    readonly until: string;
    /** Patterns that caused the latest cooldown. */
    readonly patterns: readonly ('spinning' | 'oscillation' | 'no-drift' | 'diminishing')[];
}
/** One accepted report retained for process-local diagnostics without its text. */
export interface ShadowReviewStatus {
    /** Definition that produced the report. */
    readonly shadowId: string;
    /** Runtime-generated report run id. */
    readonly runId: string;
    /** Accepted epistemic classification. */
    readonly verdict: ShadowVerdict;
    /** Ordered durable anchors from the report envelope. */
    readonly refs: readonly number[];
    /** Root event sequence captured by the run. */
    readonly capturedThroughSeq: number;
    /** Acceptance time in ISO 8601 format. */
    readonly finishedAt: string;
}
/** Per-root runtime status. */
export interface ShadowMindStatus {
    /** Whether automatic scheduling is paused. */
    readonly paused: boolean;
    /** Active runs in start order. */
    readonly active: readonly ActiveShadowStatus[];
    /** Number of turn schedules still loading or admitting work. */
    readonly pendingSchedules: number;
    /** Current cancellation epoch. */
    readonly epoch: number;
    /** Number of Shadow runs admitted during this root's process lifetime. */
    readonly totalRuns: number;
    /** Most recently finished run during this root's process lifetime. */
    readonly lastRun?: LastShadowRunStatus;
    /** Number of deterministic pre-filter skips during this root's process lifetime. */
    readonly prefilterSkips: number;
    /** Last per-definition activation probabilities after deterministic boosts. */
    readonly effectiveProbabilities: readonly ShadowEffectiveProbability[];
    /** Diagnostic challenge outcomes by definition during this process lifetime. */
    readonly valueLoop: readonly ShadowValueLoopStatus[];
    /** Prompt plus accepted-report characters spent since the latest real user input. */
    readonly spentChars: number;
    /** Current budget routing tier. */
    readonly budgetTier: 'standard' | 'frugal' | 'exhausted';
    /** Non-expired per-definition wall-clock cooldowns. */
    readonly cooldowns: readonly ShadowCooldownStatus[];
    /** Definitions whose next admitted run will use one higher reasoning-effort rung. */
    readonly pendingEscalations: readonly string[];
    /** Recent accepted report metadata, including reports replaced by synthesis. */
    readonly recentReviews: readonly ShadowReviewStatus[];
    /** Conflict-synthesis runs admitted during this process lifetime. */
    readonly synthesisRuns: number;
    /** Conflict-synthesis attempts that failed open during this process lifetime. */
    readonly synthesisFailures: number;
    /** Latest fail-open reason. */
    readonly lastSynthesisFailure?: string;
    /** Commands the gate denied during this process lifetime. */
    readonly gateDenies: number;
    /** Commands the gate allowed during this process lifetime. */
    readonly gateAllows: number;
    /** Gate judge runs admitted during this process lifetime. */
    readonly gateJudgeRuns: number;
    /** Gate judge runs that failed or timed out during this process lifetime. */
    readonly gateJudgeFailures: number;
}
