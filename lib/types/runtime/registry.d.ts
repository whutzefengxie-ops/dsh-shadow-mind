/**
 * Markdown/YAML Shadow definition registry with isolated diagnostics and atomic writes.
 * The runtime schedules exactly one Shadow definition (`default`); every other
 * Markdown file is kept read-only for diagnostics and never participates in scheduling.
 * @module @whutzefengxie-ops/dsh-shadow-mind/registry
 */
import type { ShadowCatalog, ShadowDefinition, ShadowDefinitionInput } from './types.ts';
/** Valid Shadow identifiers and canonical definition filenames. */
export declare const SHADOW_ID_PATTERN: RegExp;
/** Built-in duty prompt used when `default.md` is created from scratch. */
export declare const DEFAULT_SHADOW_PROMPT: string;
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
     * Load the single scheduled Shadow definition, creating `default.md` on first
     * access. When legacy definition files exist, the default is seeded from the
     * first one so an existing user's reviewer persona survives migration; its
     * activation probability always converges to the 70% product default.
     * @returns The validated default definition.
     */
    defaultDefinition(): Promise<ShadowDefinition>;
    /**
     * Persist the complete single Shadow definition as `default.md`.
     * @param input Complete wire fields for the default Shadow.
     * @returns Validated definition with its source path.
     */
    saveDefault(input: ShadowDefinitionInput): Promise<ShadowDefinition>;
    /**
     * Append one JSON Lines debug record for a definition that opted in.
     * @param id Definition id used as the log filename.
     * @param record Diagnostic record to append.
     */
    appendDebug(id: string, record: Record<string, unknown>): Promise<void>;
    /** Serialize same-id mutations while allowing independent ids to overlap. */
    private mutate;
}
