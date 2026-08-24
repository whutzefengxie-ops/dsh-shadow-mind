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
import type { CreateShadowDefinition, ShadowAdministrationSnapshot, ShadowCatalog, ShadowDefinition, ShadowDefinitionInput, ShadowMindConfig, ShadowMindSettings, ShadowMindStatus, UpdateShadowDefinition } from './types.ts';
export { Config } from './config.ts';
export * from './types.ts';
export * from './protocol.ts';
export { ShadowRegistry, parseShadowDefinition, SHADOW_ID_PATTERN } from './registry.ts';
export { seededRandom } from './random.ts';
export { optionalModelRoute, SHADOW_MODEL_ROUTE_PATTERN } from './model-route.ts';
export { modelEligible, selectShadows } from './scheduler.ts';
export { buildShadowPrompt, projectTrajectory, summarizeToolResult } from './trajectory.ts';
export { ReportBatcher } from './report-batcher.ts';
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
     * @returns Current catalog and definition directory.
     */
    remoteExportCatalog(): Promise<ShadowAdministrationSnapshot>;
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
     * Persist a partial user-settings patch.
     * @param patch Settings fields to replace.
     */
    updateSettings(patch: Partial<ShadowMindSettings>): Promise<void>;
    /**
     * Return per-root orchestration status without creating state for an untouched root.
     * @param agent Root agent to inspect.
     * @returns Current scheduling and run status.
     */
    status(agent: Agent): ShadowMindStatus;
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
    /** Handle turn closure and user-cancellation boundaries from the durable log. */
    private onSessionEvent;
    /** Refresh definitions, sample gates, and synchronously reserve selected ids. */
    private scheduleTurn;
    /** Reserve one active id before provider startup and start its owned lifecycle. */
    private launch;
    /** Execute, dispose, validate, and optionally accept one Shadow result. */
    private runShadow;
    /** Publish the terminal summary retained by status after active work disappears. */
    private recordOutcome;
    /** Append an opt-in debug record without letting diagnostics fail a run. */
    private debug;
    /** Get or create root-owned mutable state. */
    private owner;
    /** Deliver only reports still current at the end of the batch window. */
    private deliver;
    /** Claim idle headless lifetime until Shadow scheduling and report delivery converge. */
    private startHeadlessMaintenance;
    /** Await every schedule, active lifecycle, and report batch for one owner. */
    private drainOwner;
    /** Cancel admitted work and advance the stale-result epoch. */
    private cancelOwner;
    /** Drain and remove one owner state exactly once. */
    private releaseOwner;
    /** Whether an asynchronous run may still affect this exact root. */
    private accepts;
    /** Whether an agent is a top-level root rather than a subagent child. */
    private isRoot;
    /** Reject commands and APIs that target a child agent. */
    private assertRoot;
}
export default ShadowMindRuntime;
export type { ActiveShadowStatus, CreateShadowDefinition, LastShadowRunStatus, ShadowAdministrationSnapshot, ShadowCatalog, ShadowDefinition, ShadowDefinitionInput, ShadowDiagnostic, ShadowMindConfig, ShadowMindSettings, ShadowMindStatus, ShadowRunOutcome, UpdateShadowDefinition, } from './types.ts';
export type { ShadowReportMessageSource, ShadowReportProvenance } from './protocol.ts';
