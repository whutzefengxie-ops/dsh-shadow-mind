/**
 * Probabilistic Shadow orchestration for root agents: fresh read-only subagents
 * inspect a reasoning-free durable trajectory and relay only structured,
 * accepted findings.
 * @module @whutzefengxie-ops/dsh-shadow-mind
 */
import { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { ShadowRegistry } from './registry.ts';
import type { CreateShadowDefinition, ShadowAdministrationSnapshot, ShadowCatalog, ShadowDefinition, ShadowDefinitionInput, ShadowMindConfig, ShadowMindSettings, ShadowMindStatus, ShadowModelCatalog, ShadowReviewCycle, UpdateShadowDefinition, UpdateShadowMindSettings } from './types.ts';
export { Config } from './config.ts';
export * from './types.ts';
export * from './protocol.ts';
export { ShadowRegistry, parseShadowDefinition, SHADOW_ID_PATTERN } from './registry.ts';
export { seededRandom } from './random.ts';
export { optionalModelRoute, SHADOW_MODEL_ROUTE_PATTERN } from './model-route.ts';
export { modelEligible, selectShadows } from './scheduler.ts';
export { buildShadowPrompt, projectTrajectory, projectTrajectoryWithAnchors, summarizeToolResult } from './trajectory.ts';
export { PERSONA_AFFINITIES, PROBE_CLASSES_V1, renderProbeChecklist } from './probes.ts';
export { boostPredicates, matchesPredicate, prefilterPredicates } from './prefilter.ts';
export { preferIndependentCandidates, resolveIndependence, vendorFamily } from './vendor.ts';
export { classifyChallenge, classifyChallengeObservation, observeChallenge, } from './value-loop.ts';
export type { ChallengeObservation, ShadowValueClassification, ValueLoopChallenge, } from './value-loop.ts';
export { detectPatterns } from './review-window.ts';
export type { ReviewEntry, ReviewWindowOptions, StagnationDetection, } from './review-window.ts';
export { buildSynthesisPrompt, containsHoldoutLiteral, redactHoldoutLiterals, selectShadowConflict, } from './synthesis.ts';
export type { ShadowConflict } from './synthesis.ts';
export { ReportBatcher } from './report-batcher.ts';
export { CommandGate, GATE_OUTPUT_SCHEMA } from './command-gate.ts';
export type { CommandGateStats, GateCommand, GateJudgeOutcome, GateTier, GateVerdict } from './command-gate.ts';
export { buildShadowModelCatalog } from './model-catalog.ts';
export type { ShadowCatalogModel, ShadowModelCatalog, ShadowModelEffort, ShadowModelFailure, ShadowModelGroup, ShadowModelReasoning, } from './model-catalog.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        shadowMind: ShadowMindRuntime;
    }
}
/** User-settings namespace for live Shadow orchestration controls. */
export declare const SHADOW_MIND_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Tools visible to every Shadow before definition-specific additions. */
export declare const DEFAULT_SHADOW_TOOLS: readonly ["read", "grep", "glob"];
/** Root-only Shadow orchestration service. */
export declare class ShadowMindRuntime extends TypertRemoteService {
    static inject: string[];
    static Config: import("@deepseek-ai/schemastery").default<ShadowMindConfig>;
    /** Definition and debug-log store. */
    readonly registry: ShadowRegistry;
    private settingsValue;
    private readonly settingsScope;
    private random;
    private readonly owners;
    private readonly gate;
    private stopped;
    /** @param ctx Cordis context carrying agents, subagents, and settings. @param config Deployment base settings. */
    constructor(ctx: Context, config?: ShadowMindConfig);
    /**
     * Load the current definition catalog.
     * @returns Current valid definitions and isolated file diagnostics.
     */
    listDefinitions(): Promise<ShadowCatalog>;
    /**
     * Load definitions and their storage directory for the trusted Web administration page.
     * @returns Current catalog, definition directory, and the live DSH model directory.
     */
    remoteExportCatalog(): Promise<ShadowAdministrationSnapshot>;
    /**
     * Load the live DSH provider/model/effort directory plus the agent-preset roster.
     * @returns Detached directory for the Web settings dropdowns.
     */
    modelCatalog(): Promise<ShadowModelCatalog>;
    /**
     * Create one complete definition submitted by the Web administration page.
     * @param input Validated wire fields.
     * @returns Persisted definition.
     */
    remoteExportCreate(input: ShadowDefinitionInput): Promise<ShadowDefinition>;
    /**
     * Replace every editable field of one definition from the Web administration page.
     * @param input Complete wire fields including the existing id.
     * @returns Persisted definition.
     */
    remoteExportUpdate(input: ShadowDefinitionInput): Promise<ShadowDefinition>;
    /**
     * Enable or disable one definition from the Web administration page.
     * @param id Definition id.
     * @param enabled Next scheduling state.
     * @returns Persisted definition.
     */
    remoteExportSetEnabled(id: string, enabled: boolean): Promise<ShadowDefinition>;
    /**
     * Delete one definition from the Web administration page while preserving its debug log.
     * @param id Definition id.
     */
    remoteExportDelete(id: string): Promise<void>;
    /**
     * Create a definition atomically.
     * @param input Complete definition fields.
     * @returns Validated persisted definition.
     */
    createDefinition(input: CreateShadowDefinition): Promise<ShadowDefinition>;
    /**
     * Update a definition atomically.
     * @param id Existing definition id.
     * @param patch Fields to replace.
     * @returns Updated validated definition.
     */
    updateDefinition(id: string, patch: UpdateShadowDefinition): Promise<ShadowDefinition>;
    /**
     * Enable or disable a definition atomically.
     * @param id Existing definition id.
     * @param enabled Next scheduling state.
     * @returns Updated validated definition.
     */
    setEnabled(id: string, enabled: boolean): Promise<ShadowDefinition>;
    /**
     * Delete a definition while preserving debug logs.
     * @param id Existing definition id.
     */
    deleteDefinition(id: string): Promise<void>;
    /**
     * Return the current immutable resolved settings.
     * @returns Live resolved settings snapshot.
     */
    currentSettings(): ShadowMindSettings;
    /**
     * Atomically persist selected settings; null removes an optional user override.
     * @param patch Settings fields to set or clear.
     * @returns A promise settled after the settings mutation commits.
     */
    updateSettings(patch: UpdateShadowMindSettings): Promise<void>;
    /**
     * Return per-root orchestration status without creating state for an untouched root.
     * @param agent Root agent to inspect.
     * @returns Current scheduling and run status.
     */
    status(agent: Agent): ShadowMindStatus;
    /**
     * Return model-invisible review cycles for conversation cards.
     * @param agent Root agent whose turns own the cycles.
     * @returns Current process-lifetime lifecycle snapshots in trigger order.
     */
    reviewCycles(agent: Agent): readonly ShadowReviewCycle[];
    /**
     * Pause scheduling for a root and cancel its admitted work.
     * @param agent Root agent to pause.
     * @returns Status after the transition.
     */
    pause(agent: Agent): ShadowMindStatus;
    /**
     * Resume future scheduling for a root.
     * @param agent Root agent to resume.
     * @returns Status after the transition.
     */
    resume(agent: Agent): ShadowMindStatus;
    /**
     * Toggle automatic scheduling for a root.
     * @param agent Root agent to update.
     * @returns Status after the transition.
     */
    toggle(agent: Agent): ShadowMindStatus;
    /**
     * Manually re-run one failed or aborted Shadow against its original
     * captured trajectory window. The retried run joins the same review cycle,
     * bypasses pause and the exhausted budget tier, and is admission-gated by
     * the same liveness rules as scheduled runs.
     * @param agent Root agent whose run is retried.
     * @param runId Terminal run to rerun.
     * @returns Status after the retry was admitted.
     */
    retry(agent: Agent, runId: string): Promise<ShadowMindStatus>;
    /** Handle turn closure and user-cancellation boundaries from the durable log. */
    private onSessionEvent;
    /** Admit challenge envelopes to the diagnostic value-loop window. */
    private captureValueChallenges;
    /** Classify settled challenge windows and append metadata-only diagnostic records. */
    private evaluateValueChallenges;
    /** Increment exactly one terminal value-loop counter. */
    private incrementValueClassification;
    /** Refresh definitions, sample gates, and synchronously reserve selected ids. */
    private scheduleTurn;
    /** Reserve one active id before provider startup and start its owned lifecycle. */
    private launch;
    /** Execute, dispose, validate, and optionally accept one Shadow result. */
    private runShadow;
    /** Publish one terminal view and its redacted debug record. */
    private finishRun;
    /** Refresh the compact status record from one terminal run view. */
    private updateLastRun;
    /** Retain one accepted envelope, update decay, and apply its latest stagnation action. */
    private recordReviewEntry;
    /** Resolve one higher configured reasoning-effort rung. */
    private nextReasoningEffort;
    /** Append an opt-in metadata record without letting diagnostics fail a run. */
    private debugMetadata;
    /** Append an opt-in lifecycle record without model inputs, report content, paths, or stacks. */
    private debug;
    /** Get or create root-owned mutable state. */
    private owner;
    /** Resolve the current budget tier without mutating its counters. */
    private budgetTier;
    /** Clear suppression actions whose meaning is tied to the current control state. */
    private resetCoordination;
    /** Start a fresh user-owned budget and review epoch. */
    private resetSessionGovernance;
    /** Replace one selected conflict with a fresh synthesized report, or fail open. */
    private synthesizeConflict;
    /** Record a fail-open synthesis outcome without report text. */
    private recordSynthesisFailure;
    /** Append synthesis diagnostics and contain storage failures. */
    private appendSynthesisDebug;
    /** Deliver only reports still current at the end of the batch window. */
    private deliver;
    /** Find one retained run record by its opaque id. */
    private findRun;
    /** Replace a not-yet-relayed report with its cancellation outcome. */
    private discardPendingReport;
    /** Apply cancellation to one retained pending report and record the delivery decision. */
    private discardPendingEntry;
    /** Surface an admitted report that could not enter the root inbox. */
    private failReportDelivery;
    /** Claim idle headless lifetime until Shadow scheduling and report delivery converge. */
    private startHeadlessMaintenance;
    /** Await every schedule, active lifecycle, and report batch for one owner. */
    private drainOwner;
    /** Record and request cancellation for one active run exactly once. */
    private requestCancellation;
    /** Cancel admitted work and advance the stale-result epoch. */
    private cancelOwner;
    /** Drain and remove one owner state exactly once. */
    private releaseOwner;
    /** Whether an asynchronous run may still affect this exact root. */
    private accepts;
    /** Per-root command-gate counters for runtime status. */
    private gateStats;
    /** Resolve the model selection the gate judge runs under. */
    private gateModelSelection;
    /**
     * Settle one intercepted command through a fresh gate-judge child. Every
     * failure path returns a `failure` outcome instead of throwing, so the
     * gate's fail-open/fail-closed policy stays the only decision maker.
     * @param agent Root agent whose command is under review.
     * @param command Extracted command under review.
     * @param signal Root turn signal; the judge aborts with it.
     * @returns One judge settlement.
     */
    private judgeVerdict;
    /** Build the bounded judge prompt from the environment declaration and recent trajectory. */
    private buildGateJudgePrompt;
    /** Append one gate diagnostic record without letting storage failures escape. */
    private appendGateLog;
    /** Whether an agent is a top-level root rather than a subagent child. */
    private isRoot;
    /** Reject commands and APIs that target a child agent. */
    private assertRoot;
}
export default ShadowMindRuntime;
export type { ActiveShadowStatus, CreateShadowDefinition, LastShadowRunStatus, ShadowAdministrationSnapshot, ShadowCatalog, ShadowDefinition, ShadowDefinitionInput, ShadowDiagnostic, ShadowMindConfig, ShadowMindSettings, ShadowMindStatus, ShadowRunOutcome, UpdateShadowDefinition, } from './types.ts';
export type { ShadowReportMessageSource, ShadowReportProvenance } from './protocol.ts';
