# Settings Rework and Product Convergence Plan (Single Shadow Reviewer)

[中文](settings-ux-revamp.zh.md) | English

This document responds to the latest wave of user complaints with a second round of convergence for the Shadow Mind settings page and scheduling model: the product moves from "a multi-Shadow jury plus a command review" to **one Shadow reviewer** — a single capability — with reworked interactions. It records the implementation results and supersedes the parts of `settings-ux-analysis.md` that still describe the multi-definition model.

> **Implementation status (complete)**: runtime, tool surface, client, tests, and docs all follow this plan and pass `pnpm run check`. Highlights: a single `default` definition is auto-created (legacy definitions kept read-only, probability unified to 70%, default timeout 600 seconds); the multi-definition CRUD API is deleted; `synthesis.ts`, `prefilter.ts`, and `command-gate.ts` are deleted outright; the settings page is rebuilt as a single Shadow card with toasts and a 10%–100% probability slider (step 10%, default 70%).

## 1. Reflection: root causes behind the feedback

The six complaints are symptoms. Five root causes sit underneath, and the plan fixes the causes, not just their positions:

1. **Feedback rendered as content, status rendered as page**. Save/error notices render in a `<p role="status">` at the top of the page; they scroll away and users never know whether an operation succeeded. The root cause is that the plugin has no "event notification" channel — and the host apps/web has no reusable toast component either, so the plugin must build one. The same disease shows up elsewhere: the global settings and the command review each had their own "Save" button sharing one draft, and the command-review numeric fields lived inside the global advanced disclosure, separated from the command-review card.
2. **Developer metrics presented as user content**. The session-status panel flattened 15+ runtime metrics (epoch, prefilterSkips, budgetTier, spentChars, synthesisRuns, cooldowns, pendingEscalations, recentReviews…), meaningless to users. Users care about three things: is the capability on, what is the probability, and what did the latest review find.
3. **Two probability knobs**. The old "activation probability" was a two-stage lottery: global `heartbeatProbability` (default 33%) × each definition's `activationProbability` (default 30%), a combined trigger rate of roughly 10% that nobody can reason about. Users want a single "per-turn trigger probability", default 70%. Once the product is single-Shadow, this layer disappears entirely.
4. **Controls dumped straight from schema enums**. Booleans rendered as true/false dropdowns, enums displayed as raw internal values (`root-only`, `deny`, `redacted`), camelCase keys used as labels — all artifacts of "the form maps the config object 1:1".
5. **No capability boundaries**. Shadow review and command review shared one settings schema and two separately-saving forms. The definition list, template panel, and diagnostics panel sat alongside settings with no hierarchy.

Beyond the literal complaints, six more classes of problems needed fixing:

6. **Unintelligible errors**. Remote errors surfaced raw internal jargon such as `shadowMind.create failed: internal: holdout definition … needs <DSH_HOME>\shadow-minds\holdout-keys.json`. An error-code → human-message map with next-step advice is required.
7. **Migration compatibility**. After cutting multi-Shadow, synthesis, and predicates, what happens to existing definition files on disk and previously saved settings? Schemastery's `z.object` strips unknown keys by default, so old settings degrade safely; definition files stay on disk, and the UI manages one default definition.
8. **Tool surface and the `/shadow` command must follow**. The agent tools and the `/shadow` status output also exposed the cut concepts (prefilter skips, synthesis stats).
9. **Docs and examples must follow**. `target-architecture`, `review-quality-directions`, and `examples/` described the multi-Shadow jury and predicate library.
10. **Accessibility**. The slider needs keyboard ±10%, a value bubble, and aria semantics; switches need `role="switch"`; toasts need `aria-live`.
11. **Command-review reliability itself**. During implementation we observed the gate judge chain deadlocking in the real environment (a hung judge subagent occupies the only concurrency slot, so every later gated command aborts in the queue with `command gate judge wait aborted`). A fragile adjudicator is worse than none. Additional decision: **delete the command-review capability entirely** (deterministic deny/allow tiers, judge, settings, and counters), not just repair the judge.

## 2. Optimization overview

| # | Source | Optimization | Plan summary (with result) |
| --- | --- | --- | --- |
| 1 | Feedback 1 | Toast notifications | Fixed bottom-right, linearly stacked toasts with auto-dismiss; top-of-page message removed ✅ |
| 2 | Feedback 2a | Shadow capability switch | Card-level Switch with a clear on/off ✅ |
| 3 | Feedback 2b | Single probability slider | range 10%–100%, step 10%, default 70%, replacing the double probability ✅ |
| 4 | Feedback 2c | Execution model to advanced | Model selector moved into the advanced disclosure (empty = inherit the root agent); global `defaultShadowModel`/`defaultReasoningEffort` deleted ✅ |
| 5 | Feedback 3 | Cut multi-Shadow discussion | Definition list/create/delete/template panel removed, single Shadow card; single-roll scheduling; conflict synthesis deleted ✅ |
| 6 | Feedback 4 | Humanized controls | Boolean → Switch; all labels in real language ✅ |
| 7 | Feedback 5 | Command review as its own capability | **Additional decision: delete the capability entirely** (the gate deadlocks and users cannot see it); no second card ✅ |
| 8 | Feedback 6 | Remove predicate configuration | Definition-level preFilters/boostFilters/boostFactor and the global long-output/repeated-report/repeated-failure thresholds removed; predicate library deleted ✅ |
| 9 | Beyond | Unified save semantics | One page-level Save action + "saved and applied" toast ✅ |
| 10 | Beyond | Humanized error copy | Error-code → human-message map + actionable advice, delivered via toast ✅ |
| 11 | Beyond | Minimal status panel | Only "latest review result and time"; every other metric removed ✅ |
| 12 | Beyond | Migration compatibility | Old settings keys safely ignored (Schemastery passes unknown keys through without error and the new runtime never reads them); legacy definitions kept read-only; `default.md` seeded from the first legacy definition (name/duty inherited, probability unified to 70%) ✅ |
| 13 | Beyond | Tool surface convergence | create/update/delete/enable/disable_shadow deleted; `update_default_shadow` added; `/shadow` output simplified ✅ |
| 14 | Beyond | Docs and accessibility | Docs synced; keyboard/aria support ✅ |

## 3. Concrete plans (matching the implementation)

### 3.1 Toast notifications

- New `src/client/ToastStack.tsx`: fixed bottom-right container; each toast is `{ id, kind, text }`, linearly stacked (newest on top); success auto-dismisses after 3 s, errors after 6 s, manual close supported; `role="status"/"alert"` plus `aria-live`.
- The settings page drops the top-of-page `message` rendering; load failures, save success, and errors all go through `push(kind, text)`.
- `friendlyError(error, t)` renders known errors as human text with a next-step suggestion.

### 3.2 Information architecture: one capability card

The page keeps a single **Shadow review** card: switch, probability slider, review-style preset dropdown, name, duty prompt, and an advanced disclosure (execution model, timeout, additional tools, trajectory capture, context inheritance, think-first, debug). The card shows a "latest review: outcome · time" status line. Removed: the session-status mega-panel, the definition list, create/edit/delete panels, the template panel (now a prompt-preset dropdown), the command-review section, and the standalone diagnostics panel (only a warning line when file diagnostics exist). Legacy definition files appear as a read-only note.

### 3.3 Single probability slider

- New `ProbabilitySlider` (`src/client/controls.tsx`): `<input type="range" min="10" max="100" step="10">` with a value bubble, arrow keys ±10%, aria semantics.
- Runtime drops `heartbeatProbability`; new constant `DEFAULT_ACTIVATION_PROBABILITY = 0.7`; single-roll scheduling via `shouldRunShadow(probability, random)`.
- Migration: `default.md` is created with probability 0.7 (including the legacy-seeded case).

### 3.4 Humanized controls

- New `Switch` (`role="switch"` + `aria-checked`) replaces all boolean dropdowns.
- All labels and hints come from locales; no raw camelCase keys or enum values.

### 3.5 Single Shadow + cut synthesis

- `scheduler.ts`: `selectShadows` multi-selection replaced by `shouldRunShadow`; scheduling uses only the `default` definition, at most one reviewer run per root at a time.
- Delete `src/runtime/synthesis.ts` and, in `runtime/index.ts`, the conflict detection, synthesis state, and status-panel fields; `replacesRunIds` removed from `report-batcher.ts`/`protocol.ts`.
- `config.ts`/`types.ts` delete: `heartbeatProbability`, `maxParallelShadows`, `synthesisModel`, `synthesisReasoningEffort`, `conflictSynthesisEnabled`, `conflictSynthesisTimeoutSeconds`, `preferIndependentVendor`, `defaultShadowModel`, `defaultReasoningEffort` (the independence computation stays for report display).
- Definition management (`registry.ts`): fixed id `default`. On first access, if `default.md` is missing it is created (built-in general review prompt); when legacy definitions exist, the default inherits the first one's name/duty prompt and execution configuration while the probability is unified to 0.7; legacy files stay read-only and are never scheduled. The generic CRUD (create/update/setEnabled/delete) is deleted; `saveDefault` is added.
- The template panel becomes a "review style" preset dropdown (contrarian/hacker/researcher/simplifier/architect/implementation-reviewer): choosing one pre-fills the duty prompt and capture window.

### 3.6 Remove predicate configuration

- Delete `src/runtime/prefilter.ts`, its exports, and its tests; definition-level `preFilters`/`boostFilters`/`boostFactor` and the global `longOutputBoostChars`, `lastReportCoversCount`, `repeatedFailureBoostThreshold` are removed; legacy definition files carrying these front-matter keys are parsed tolerantly (ignored).
- `runtime/index.ts` drops `prefilterSkips`, `effectiveProbabilities`, and predicate evaluation in `scheduleTurn`.
- `probes.ts` is kept (the probe checklist inside review prompts is prompt content, not scheduling predicates).

### 3.7 Command review: deleted outright (additional decision)

- Delete `src/runtime/command-gate.ts`, all `commandGate*` settings, the judge orchestration, Tier 0/1 patterns, counters, and status fields; `config.ts`/`types.ts`/`runtime/index.ts`/`tool/index.ts`/`client/*` and the generated typert artifacts plus the patch script converge accordingly.
- Rationale: in the real environment the judge chain can deadlock permanently (slot occupied → every later gated command aborts with `command gate judge wait aborted`); a feature that unreliable is not worth maintaining.

### 3.8 Migration compatibility

- Settings: Schemastery's `z.object` passes unknown keys through without error — removed fields keep their old persisted values in the store, but the new runtime never reads any related field (verified by parsing the real `settings.yaml` with the new build: no load error, no adjudication error), so no migration script is needed; the old keys can be cleaned up by a natural store rewrite later.
- Definition files: never deleted from disk; non-default definitions are no longer scheduled and are shown read-only.
- Default probability: `default.md` is created with 0.7 (overriding old values, per decision D3).

### 3.9 Tool surface and `/shadow`

- `tool/index.ts`: delete `create_shadow`/`update_shadow`/`enable_shadow`/`disable_shadow`/`delete_shadow`; add `update_default_shadow` (merged patch written to the default); `list_shadows` stays (default definition plus legacy diagnostics); `get_shadow_config`/`update_shadow_config` drop the cut fields from parameters and results; the `/shadow` output is reduced to "on/off, running, total runs, latest result".

### 3.10 Docs and tests

- docs: this document; `target-architecture`, `review-quality-directions`, `installation-runtime-validation`, `subagent-binding-and-command-gate-design`, and `technical-design` get their multi-Shadow/predicate/synthesis/gate descriptions marked "removed"; `examples/shadow-minds/` stays as the preset data source and is noted as such.
- tests: delete the scheduler multi-selection/prefilter/synthesis/command-gate specs; converge the registry/template/tool/typert/assembled-flow specs; add single-Shadow semantics tests (legacy definitions never scheduled).

## 4. Implementation phases and results

- **Phase A (UI layer)**: toasts, page restructure, slider, controls, error-copy mapping ✅
- **Phase B (runtime convergence)**: single-Shadow scheduling, cut synthesis, delete predicates, schema convergence, delete the command gate ✅
- **Phase C (docs and tests)** ✅; `pnpm run check` (typert verification + typecheck + 135 tests + build + smoke) is green.

## 5. Decision record

- **D1 Single-Shadow persistence**: fixed id `default` auto-created, legacy definitions kept read-only ✅
- **D2 Status panel**: all runtime metrics removed; only the latest review result remains ✅
- **D3 Default 70%**: overrides existing values on migration ✅
- **D4 Registry API**: multi-definition API deleted outright ✅
- **D5 Command review**: deleted outright (additional decision) ✅
