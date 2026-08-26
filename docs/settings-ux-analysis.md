# Settings Field Tiers and Simplification Plan

[中文](settings-ux-analysis.zh.md) | English

This document analyzes the field tiers of the Shadow Mind settings page (Settings → Plugins → Shadow Mind), the root cause of create failures, the fixes, and the design of the bundled reference templates. It is the implementation basis for the settings-page rework.

## 1. Problems

1. **Creating Shadows frequently fails**: the error `shadowMind.create failed: internal: holdout definition "…" needs <DSH_HOME>\shadow-minds\holdout-keys.json`. The root cause is the `holdout` checkbox on the create/edit form: it has no hint and no companion management UI. The moment it is checked, the registry reads the operator-maintained `holdout-keys.json` sidecar and rejects the whole operation with an opaque `internal` error when the file is absent.
2. **Information overload**: 30+ global settings and 18 per-definition fields are rendered flat in one form, with no separation between required, common, and advanced fields, so users cannot tell where to start.

## 2. Tiering principles

Tiering removes no capability; it exposes it in layers:

- **Required**: without it the definition is invalid or unusable; must be filled in the create form.
- **Basic**: commonly used items that directly affect scheduling and the execution model; always visible.
- **Advanced**: tuning items whose defaults already work; collapsed under an "Advanced" area.
- **Not exposed**: items that require operations outside the UI (for example a hand-maintained sidecar file); removed from the form, enabled by editing the definition file, and shown read-only in the list.

## 3. Definition field tiers (per Shadow)

| Field | Tier | Reason |
| --- | --- | --- |
| `id` | Required | Definition filename and report ownership; immutable after creation. |
| `name` | Required | Display name in lists, cards, and diagnostics. |
| `prompt` | Required | The Shadow's review responsibility; empty prompts are rejected. |
| `activation_probability` | Required | Scheduling probability; defaults to `0.3` but must stay visible. |
| `enabled` | Required | Whether the definition joins scheduling. |
| `run_with_model` | Basic | Chooses the Shadow's model; the most common execution adjustment. |
| `reasoning_effort` | Basic | Reasoning effort paired with the model. |
| `timeout_seconds` | Basic | A common cost control. |
| `think_first` | Basic | One click changes the review mode; recommended in the README. |
| `tools` | Basic | Extending the read-only tool allowlist is a common need. |
| `debug` | Advanced | Lifecycle JSONL diagnostics used while troubleshooting. |
| `active_for_models` | Advanced | Glob syntax has a learning curve; empty matches every model. |
| `capture` | Advanced | The `full` default suits most scenarios. |
| `context` | Advanced | `minimal` is an advanced conditioning option. |
| `pre_filter` / `boost_filter` / `boost_factor` | Advanced | Named predicates require understanding the predicate library. |
| `holdout` | Not exposed | Requires an operator-created `holdout-keys.json`; the form cannot manage that file, and checking the box only yields an opaque error. Enable it by adding `holdout: true` to the `.md` file and registering literals in the sidecar. When editing an existing definition the form preserves and forwards the loaded value, so saving never clears it. |

## 4. Global settings tiers

| Field | Tier | Reason |
| --- | --- | --- |
| `heartbeatProbability` | Basic | The master switch; zero disables automatic scheduling. |
| `maxParallelShadows` | Basic | The main concurrency and cost knob. |
| `defaultShadowTimeoutSeconds` | Basic | Default run deadline. |
| `defaultShadowModel` | Basic | Default execution model. |
| `defaultReasoningEffort` | Basic | Default reasoning effort. |
| `maxPromptChars` / `maxReportChars` | Advanced | Prompt and relay limits; defaults work. |
| `argumentDisclosure` | Advanced | Privacy/capability tradeoff; `redacted` is the safer default. |
| `preferIndependentVendor` | Advanced | Jury independence preference. |
| `longOutputBoostChars` and other boost/skip thresholds | Advanced | Coupled to the predicate library; defaults work. |
| `valueLoopEnabled` and its window | Advanced | Diagnostic statistics. |
| `reviewWindowSize` and the stagnation-detection family | Advanced | Review deduplication and cooldown tuning. |
| `reasoningEffortLadder` | Advanced | Escalation ladder. |
| `sessionShadowSoftBudgetChars` / `sessionShadowHardBudgetChars` / `frugalShadowModel` | Advanced | Budget routing; the three fields must move together. |
| `staleReportDecay` | Advanced | Repeated-report decay. |
| `conflictSynthesisEnabled` / `conflictSynthesisTimeoutSeconds` | Advanced | Synthesis switch and deadline. |
| `resultBatchWindowMs` | Advanced | Relay batching window. |
| `headlessDrainTimeoutSeconds` | Advanced | Convergence deadline used only by headless processes. |
| `randomSeed` | Advanced | Debug switch for reproducible scheduling. |

Global settings have no "not exposed" tier: the save protocol requires the complete resolved settings, and hidden fields would be carried silently by the form draft, creating "changed but invisible" confusion. Everything stays, collapsed under "Advanced settings".

## 5. Bundled reference templates

A "Reference templates" panel lists six templates: `contrarian`, `hacker`, `researcher`, `simplifier`, `architect` (from `examples/shadow-minds/`) and `implementation-reviewer` (implementation-quality review). Templates live only in the client bundle:

- They are never written to the definition directory and never scheduled (not activated);
- "Use template" pre-fills id, name, activation probability, capture, and the responsibility prompt into the create form; nothing is persisted until the user explicitly clicks "Create";
- The button is disabled when a definition with the template id already exists, avoiding "already exists" errors.

Template prompts follow the shipped persona rules: report only trajectory-supported, actionable issues; mark evidence gaps when evidence is missing; reports must cite only sequence numbers actually rendered in the current trajectory.

## 6. Holdout fix

1. Remove the `holdout` checkbox from the create/edit form; `DefinitionDraft` keeps the field for edit round-tripping, and creation always sends `false`. The Web UI can no longer trigger the missing-sidecar failure path.
2. `ShadowRegistry.holdoutKeys` reports a missing file with an actionable message: the absolute sidecar path, the expected JSON shape (`{"<id>": ["<literal>", …]}`), and the hint to create the file as the operator or remove `holdout: true` from the definition.
3. The definition list and diagnostics panel keep showing holdout state and missing-sidecar diagnostics read-only.

## 7. Implementation checklist

- `docs/settings-ux-analysis.md` / `.zh.md` / `.i18n.yaml`: this plan.
- `src/client/templates.ts`: bundled template data.
- `src/client/ShadowMindSettingsTab.tsx`: grouped forms, template panel, holdout checkbox removal.
- `src/client/locales.ts`: new group, template, and action copy (Chinese and English).
- `src/client/ShadowMindSettingsTab.module.css`: group, disclosure, and template card styles.
- `src/runtime/registry.ts`: actionable holdout-sidecar error.
- `tests/templates.spec.ts`: automated coverage for template data and prefill conversion.
