/** Auditable Shadow probe classes and persona affinities. @module @whutzefengxie-ops/dsh-shadow-mind/probes */
/** One deterministic trajectory trigger paired with the probe a reviewer may perform. */
export interface ProbeClass {
    readonly id: string;
    readonly name: string;
    readonly trigger: string;
    readonly probe: string;
}
/** Harness-owned probe library for durable tool-call trajectories. */
export declare const PROBE_CLASSES_V1: readonly ProbeClass[];
/** Review failure classes best matched by each starter persona. */
export declare const PERSONA_AFFINITIES: Readonly<{
    readonly contrarian: readonly ["failed_tool_call", "redacted_arguments", "stale_read", "misleading_success", "repeated_failure", "long_output"];
    readonly hacker: readonly ["repeated_failure", "misleading_success"];
    readonly researcher: readonly ["redacted_arguments", "long_output"];
    readonly simplifier: readonly ["repeated_failure", "long_output"];
    readonly architect: readonly ["stale_read", "misleading_success"];
}>;
/**
 * Render a stable model-facing trigger-and-probe checklist.
 * @param classes Probe classes to include.
 * @returns Markdown checklist with the evidence rule.
 */
export declare function renderProbeChecklist(classes: readonly ProbeClass[]): string;
