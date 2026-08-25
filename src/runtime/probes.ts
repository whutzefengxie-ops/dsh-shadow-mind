/** Auditable Shadow probe classes and persona affinities. @module @whutzefengxie-ops/dsh-shadow-mind/probes */

/** One deterministic trajectory trigger paired with the probe a reviewer may perform. */
export interface ProbeClass {
  readonly id: string
  readonly name: string
  readonly trigger: string
  readonly probe: string
}

/** Harness-owned probe library for durable tool-call trajectories. */
export const PROBE_CLASSES_V1: readonly ProbeClass[] = Object.freeze([
  { id: 'failed_tool_call', name: 'Failed tool call', trigger: 'A tool result records an error.', probe: 'Check whether the root identified the cause and changed its next action.' },
  { id: 'redacted_arguments', name: 'Redacted arguments', trigger: 'A tool call renders arguments as [redacted].', probe: 'State the evidence gap; never infer or claim the hidden arguments were checked.' },
  { id: 'stale_read', name: 'Stale read', trigger: 'A path is read and later rewritten.', probe: 'Check whether later conclusions depend on content captured before the rewrite.' },
  { id: 'misleading_success', name: 'Misleading success', trigger: 'A successful tool result is followed by an error from the same tool.', probe: 'Compare the two outcomes and test whether the earlier success overstated completion.' },
  { id: 'repeated_failure', name: 'Repeated failure', trigger: 'The same tool fails at least three times.', probe: 'Check whether retries changed a relevant input or merely repeated the failing action.' },
  { id: 'long_output', name: 'Long output', trigger: 'A tool result approaches the trajectory projection bound.', probe: 'Check whether conclusions rely on omitted detail and report that evidence gap explicitly.' },
])

/** Review failure classes best matched by each starter persona. */
export const PERSONA_AFFINITIES = Object.freeze({
  contrarian: ['failed_tool_call', 'redacted_arguments', 'stale_read', 'misleading_success', 'repeated_failure', 'long_output'],
  hacker: ['repeated_failure', 'misleading_success'],
  researcher: ['redacted_arguments', 'long_output'],
  simplifier: ['repeated_failure', 'long_output'],
  architect: ['stale_read', 'misleading_success'],
} as const)

/**
 * Render a stable model-facing trigger-and-probe checklist.
 * @param classes Probe classes to include.
 * @returns Markdown checklist with the evidence rule.
 */
export function renderProbeChecklist(classes: readonly ProbeClass[]): string {
  return [
    '## Probe checklist',
    ...classes.flatMap(item => [
      `- ${item.name} (\`${item.id}\`)`,
      `  - Trigger: ${item.trigger}`,
      `  - Probe: ${item.probe}`,
    ]),
    '',
    'Report an evidence gap when a probe cannot be run. Never claim a probe ran without trajectory evidence.',
  ].join('\n')
}
