# Shadow Mind review-quality directions

English | [中文](review-quality-directions.zh.md)

This reference defines eight review-quality mechanisms adapted from the ouroboros lineage to the plugin's fresh-child scheduler. **Note**: D2 (deterministic predicates) and D6 (conflict synthesis) have been removed with the product convergence, see [`settings-ux-revamp.md`](settings-ux-revamp.md); the command-review capability was also deleted outright. The remaining mechanisms use validated definition fields, settings, durable Session events, and bounded process-local metadata; they do not install another workflow engine.

## D1: Probe-class library

`PROBE_CLASSES_V1` is the source of truth for failed tool calls, redacted arguments, stale reads, misleading success, repeated failure, and long output. Each class has a stable id, name, trigger, and concrete probe, and `renderProbeChecklist()` produces the reusable prompt block.

The disabled definitions in [`examples/shadow-minds/`](../examples/shadow-minds/) combine those probes with the `architect`, `contrarian`, `hacker`, `researcher`, and `simplifier` personas, and serve as the settings page's "review style" preset data source. They require an evidence gap when a probe cannot be observed and anchored refs when a report is produced. Installation never enables or copies them into `$DSH_HOME`.

## D2: Deterministic predicates (removed)

~~Definitions select skip predicates through `pre_filter` and boost predicates through `boost_filter`; unknown ids reject the definition. Skip predicates are `last-report-covers`, `tool-failure`, and `no-tool-calls`. Boost predicates are `misleading-success`, `repeated-failure`, and `long-output`.~~

~~Boosts multiply activation probability by `boost_factor` before sampling and clamp the result to one. Skips run after candidate selection and before child creation. Both paths inspect durable events without a model request; status exposes effective probabilities and the cumulative skip count.~~

The predicate library (`prefilter.ts`) and every pre/boost predicate configuration are deleted: the single-Shadow model makes one probability roll per turn and needs no predicate fine-tuning.

## D3: Anchored report envelope

A report requires non-empty `content`, a `verdict` of `challenge`, `gap`, `confirm`, or `uncertain`, optional finite `severity` from zero through one, and optional `refs`. Refs must be an ascending unique list of at most eight positive safe integers present in the exact projection. `silent` and `not_relevant` require empty content and reject every envelope field.

Relay sections sort by severity descending. Durable provenance carries verdict, refs, and optional severity; route and vendor classification remain process-local diagnostics.

## D4: Stagnation and novelty

The bounded review window retains envelope metadata, never report text. It detects identical-envelope spinning, alternating verdicts over the same refs, repeated unchanged confirmations, and a configured low share of novel envelopes.

A detection chooses one coordination action. When oscillation escalation is enabled and a higher configured `reasoningEffortLadder` value exists, it reserves that value for one run without installing a cooldown; otherwise it installs `cooldownUntil`. A real user message resets cooldowns, pending escalation, and stale decay; headless operation relies on wall-clock expiry.

## D5: Reviewer independence

Known provider prefixes and model markers map to vendor families. The resolved relationship is `independent`, `same_vendor`, `unverified`, or `unavailable`; an unknown route never implies independence. Route and relationship appear in terminal status and metadata-only diagnostics.

~~`preferIndependentVendor` defaults to false. When enabled, same-vendor candidates are removed only if at least two non-same-vendor candidates remain, preserving a viable review set instead of asserting purity from one reviewer.~~ (The multi-candidate jury setting was removed with the single-Shadow model; independence classification still appears on reports.)

## D6: Conflict synthesis (removed)

~~Within one accepted batch, a `challenge` and `confirm` conflict when their refs overlap or either side is unanchored. At most one pair is selected: the smallest severity gap wins, then the largest combined severity. Synthesis is disabled by default and requires an enabled definition whose id is `synthesizer`.~~

~~The fresh synthesizer child receives only the two already-redacted report texts, their envelope metadata, and the synthesizer instructions. It has no ordinary tools. A valid `challenge`, `gap`, or `confirm` report replaces the pair, uses the weaker input severity, and records both original run ids. The relay states that the synthesis used report text without re-verification.~~

~~Definition lookup, holdout-sidecar reads, prompt construction, hard-budget checks, output validation, provider execution, timeout, and disposal all fail open: both originals remain eligible for relay and the runtime records metadata-only diagnostics. Cancellation or an epoch change discards the stale pending relay rather than forwarding it into a newer root state.~~

Conflict synthesis (`synthesis.ts`) and its settings are deleted outright: with one Shadow there are no conflicting reviewers to reconcile.

## D7: Holdout discipline

A definition opts in with `holdout: true`. Its unique non-empty exact literals come from operator-managed `$DSH_HOME/shadow-minds/holdout-keys.json`; missing, malformed, empty, or duplicated keys reject the operation. The plugin never writes this sidecar or manages its access controls, so deployments must restrict it to the Harness operating-system account. Keys never enter definitions, management data, forms, status, provenance, or diagnostics.

Literal replacement covers the projected trajectory, framed reviewer prompt, accepted report, and root relay. A final invariant checks owner-known literals before persistence. This protects only exact strings on plugin-owned model-visible paths; it does not confine filesystem reads, change child Session persistence, or detect paraphrases.

## D8: Session budget and stale-report decay

Per-root `spentChars` counts admitted prompts and accepted reports since the latest real user message. A soft limit requires a larger hard limit and `frugalShadowModel`; reaching it routes later eligible work to that model. Reaching the hard limit stops new reviewer work without cancelling admitted children. Status reports `standard`, `frugal`, or `exhausted`.

When a definition repeats an accepted envelope, its later activation probability is multiplied by `1 - staleReportDecay`. The default zero disables decay. A real user message resets spend and decay together with coordination state.

## Diagnostic value loop

Each accepted `challenge` can be observed for `valueLoopWindowTurns` later completed root turns. Durable assistant language and tool targets classify it as `challenge_adopted`, `challenge_rejected`, or `ignored`. Process-local counters expose the classifications and explicit-disposition hit rate; `value-loop.jsonl` stores metadata without report or trajectory text. New POSIX paths request `0700` for the directory and `0600` for the journal; existing permissions and Windows ACLs remain deployment-owned.

The classifier is heuristic and has no control authority. Its output never changes scheduling, budgets, cooldowns, verdicts, or report delivery.

## Verification

Automated coverage rejects invalid probes, envelopes, definitions, settings, and holdout data while pinning each coordination outcome. Lifecycle and assembled-flow scenarios verify complete-relay redaction, cancellation, durable anchored provenance, same-child think-first execution, teardown to quiescence, and the single-Shadow semantics (legacy definitions never scheduled).
