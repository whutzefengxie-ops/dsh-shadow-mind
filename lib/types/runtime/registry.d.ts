/**
 * Markdown/YAML Shadow definition registry with isolated diagnostics and atomic writes.
 * @module @whutzefengxie-ops/dsh-shadow-mind/registry
 */
import type { CreateShadowDefinition, ShadowCatalog, ShadowDefinition, UpdateShadowDefinition } from './types.ts';
/** Valid Shadow identifiers and canonical definition filenames. */
export declare const SHADOW_ID_PATTERN: RegExp;
/**
 * Parse one complete definition document.
 * @param source Markdown source.
 * @param sourcePath Absolute source path used for defaults and diagnostics.
 * @returns Validated immutable definition.
 */
export declare function parseShadowDefinition(source: string, sourcePath: string): ShadowDefinition;
/** Local Shadow definition store rooted under one Harness home. */
export declare class ShadowRegistry {
    /** Definition directory. */
    readonly root: string;
    /** Debug-log directory preserved when definitions are deleted. */
    readonly logRoot: string;
    /** Metadata-only value-loop journal shared across sessions. */
    readonly valueLoopPath: string;
    /** Owner-only literal sidecar for holdout definitions. */
    readonly holdoutKeysPath: string;
    private readonly mutations;
    /** @param dshHome Resolved Harness home. */
    constructor(dshHome: string);
    /**
     * Append one metadata-only challenge outcome.
     * @param record Classification metadata without trajectory or report text.
     */
    appendValueLoop(record: Record<string, unknown>): Promise<void>;
    /**
     * Load and validate operator-managed literal keys for one holdout definition.
     * @param id Definition id.
     * @returns Non-empty unique literal keys.
     */
    holdoutKeys(id: string): Promise<readonly string[]>;
    /**
     * Load all readable definition files while isolating per-file failures.
     * @returns Current valid definitions and file-local diagnostics.
     */
    list(): Promise<ShadowCatalog>;
    /**
     * Create a new canonical `<id>.md` definition.
     * @param input Complete definition fields.
     * @returns Validated definition with its source path.
     */
    create(input: CreateShadowDefinition): Promise<ShadowDefinition>;
    /**
     * Update one existing definition and preserve its source path.
     * @param id Existing definition id.
     * @param patch Fields to replace.
     * @returns Updated validated definition.
     */
    update(id: string, patch: UpdateShadowDefinition): Promise<ShadowDefinition>;
    /**
     * Set one existing definition's enabled flag.
     * @param id Existing definition id.
     * @param enabled Next scheduling state.
     * @returns Updated validated definition.
     */
    setEnabled(id: string, enabled: boolean): Promise<ShadowDefinition>;
    /**
     * Delete one definition file while preserving its debug log.
     * @param id Existing definition id.
     */
    delete(id: string): Promise<void>;
    /**
     * Append one JSON Lines debug record for a definition that opted in.
     * @param id Definition id used as the log filename.
     * @param record Diagnostic record to append.
     */
    appendDebug(id: string, record: Record<string, unknown>): Promise<void>;
    /** Find one current winning definition or fail loud. */
    private expect;
    /** Serialize same-id mutations while allowing independent ids to overlap. */
    private mutate;
}
