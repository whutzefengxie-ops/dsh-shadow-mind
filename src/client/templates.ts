/**
 * Bundled reference templates for the Shadow Mind settings tab.
 * Templates are client-side only: they are never written to the definition
 * directory and never join scheduling until the user adopts one through the
 * create form.
 * @module @whutzefengxie-ops/dsh-shadow-mind/client/templates
 */

import { PROBE_CLASSES_V1, renderProbeChecklist } from '../runtime/probes.ts'
import type { ShadowDefinitionInput } from '../runtime/types.ts'
import type { ShadowMindLocaleKey } from './locales.ts'

/** Mirrors the runtime definition id pattern without importing Node-side registry code. */
const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u

/** One adoptable reference template rendered by the settings tab. */
export interface ShadowTemplate {
  /** Stable lowercase definition id proposed by the template. */
  readonly id: string
  /** Locale key for the display name. */
  readonly nameKey: ShadowMindLocaleKey
  /** Locale key for the one-line description. */
  readonly descriptionKey: ShadowMindLocaleKey
  /** Proposed activation probability. */
  readonly activationProbability: number
  /** Proposed trajectory capture window. */
  readonly capture: ShadowDefinitionInput['capture']
  /** Responsibility prompt pre-filled into the create form. */
  readonly prompt: string
}

/** Shared anchored-report rule closing every starter-persona prompt. */
const REPORT_RULE = 'When reporting, name the probe class and return an anchored verdict with only rendered sequence references.'

/** Render one starter persona prompt from the shipped probe library. */
function personaPrompt(opening: string): string {
  return [
    opening,
    '',
    renderProbeChecklist(PROBE_CLASSES_V1),
    '',
    REPORT_RULE,
  ].join('\n')
}

/** Starter personas matching `examples/shadow-minds/` plus one implementation reviewer. */
export const SHADOW_TEMPLATES: readonly ShadowTemplate[] = Object.freeze([
  {
    id: 'contrarian',
    nameKey: 'templateNameContrarian',
    descriptionKey: 'templateDescriptionContrarian',
    activationProbability: 0.3,
    capture: 'since-compaction',
    prompt: personaPrompt('Challenge the strongest root claim. Prefer a concrete counterexample over broad caution.'),
  },
  {
    id: 'hacker',
    nameKey: 'templateNameHacker',
    descriptionKey: 'templateDescriptionHacker',
    activationProbability: 0.3,
    capture: 'since-compaction',
    prompt: personaPrompt('Inspect failure handling and repeated operations. Name the probed class in every report.'),
  },
  {
    id: 'researcher',
    nameKey: 'templateNameResearcher',
    descriptionKey: 'templateDescriptionResearcher',
    activationProbability: 0.3,
    capture: 'since-compaction',
    prompt: personaPrompt('Audit whether each conclusion is supported by the rendered trajectory. Treat omitted data as an evidence gap.'),
  },
  {
    id: 'simplifier',
    nameKey: 'templateNameSimplifier',
    descriptionKey: 'templateDescriptionSimplifier',
    activationProbability: 0.3,
    capture: 'since-compaction',
    prompt: personaPrompt('Find repeated work or an unnecessary mechanism only when the trajectory demonstrates it.'),
  },
  {
    id: 'architect',
    nameKey: 'templateNameArchitect',
    descriptionKey: 'templateDescriptionArchitect',
    activationProbability: 0.3,
    capture: 'since-compaction',
    prompt: personaPrompt('Inspect cross-step consistency, stale inputs, and claims that do not follow from recorded results.'),
  },
  {
    id: 'implementation-reviewer',
    nameKey: 'templateNameImplementationReviewer',
    descriptionKey: 'templateDescriptionImplementationReviewer',
    activationProbability: 0.3,
    capture: 'since-compaction',
    prompt: [
      'Review the completed root implementation work against its task.',
      '',
      'Priority checks:',
      '',
      '1. Did the root miss an explicit requirement, constraint, or acceptance condition from the user?',
      '2. Does the final conclusion contradict tool results, file contents, test output, or recorded errors?',
      '3. Did the changes introduce a functional defect, security issue, data-loss risk, concurrency problem, or platform-specific breakage?',
      '4. Did the root claim completion without required verification?',
      '5. After a failed tool call, did the root repeat the same action without changing its input or addressing the cause?',
      '6. Does a conclusion rely on stale reads, truncated output, or redacted content treated as verified?',
      '',
      'Rules:',
      '',
      '- Report only issues directly supported by the rendered trajectory and worth the user\'s action.',
      '- Never report style preferences, naming opinions, optional refactors, or generic improvements.',
      '- Never guess hidden reasoning, redacted arguments, or omitted tool results.',
      '- Every report must state the problem, the evidence, the impact, and a suggested fix.',
      '- `refs` must only contain rendered sequence numbers from the current trajectory.',
      '- Use `gap` or `challenge` for clear violations or defects, `uncertain` when the risk is specific but evidence is missing, and `confirm` only when the review scope genuinely warrants it.',
      '- Return `silent` when the review applied but found nothing actionable, and `not_relevant` when the task does not suit an implementation review.',
    ].join('\n'),
  },
])

/* v8 ignore start -- module-level invariant; reject malformed template data before any UI renders it. */
for (const template of SHADOW_TEMPLATES) {
  if (!TEMPLATE_ID_PATTERN.test(template.id)) {
    throw new Error(`shadow template id must match ${String(TEMPLATE_ID_PATTERN)}: ${JSON.stringify(template.id)}`)
  }
  if (template.prompt.trim() === '' || template.nameKey.trim() === '' || template.descriptionKey.trim() === '') {
    throw new Error(`shadow template ${JSON.stringify(template.id)} needs a non-empty prompt, nameKey, and descriptionKey`)
  }
  if (!Number.isFinite(template.activationProbability)
    || template.activationProbability < 0 || template.activationProbability > 1) {
    throw new Error(`shadow template ${JSON.stringify(template.id)} needs an activation probability from 0 through 1`)
  }
}
if (new Set(SHADOW_TEMPLATES.map(template => template.id)).size !== SHADOW_TEMPLATES.length) {
  throw new Error('shadow template ids must be unique')
}
/* v8 ignore stop */
