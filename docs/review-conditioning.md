# Shadow Mind review conditioning

English | [中文](review-conditioning.zh.md)

This reference defines how a fresh Shadow child receives its trajectory, runtime context, model route, tools, and optional planning step. These controls are per-definition data persisted in `$DSH_HOME/shadow-minds/*.md` and use behavior-preserving defaults.

## Definition fields

| Frontmatter | Runtime value | Default | Effect |
|---|---|---|---|
| `capture` | `full` or `since-compaction` | `full` | Selects the durable root-log window rendered into the prompt. |
| `context` | `standard` or `minimal` | `standard` | Controls ordinary runtime-context and pre-step message inheritance. |
| `think_first` | boolean | `false` | Adds one tool-free planning request before investigation. |
| `run_with_model` | complete `provider/model` route | inherited | Selects the child model when supplied. |
| `reasoning_effort` | non-empty provider value | inherited | Overrides reasoning effort on the resolved child route. |

The registry, management tools, Remote data, and Web form all read and write the same fields. Unknown values reject the definition instead of falling back.

## Compaction-aware capture

`capture: full` projects visible events from the start of the Session through the triggering `turn/end`. `capture: since-compaction` finds the latest successful `compaction/end` at or before that watermark, keeps compaction summaries, and projects later visible events. Every rendered user message, assistant message, summary, tool call, and tool result includes its durable sequence.

The projection excludes reasoning, raw tool-result bodies, and future events. It renders deterministic tool-result counts and uses `argumentDisclosure` for tool arguments. The returned sequence set is also the allowlist for report `refs`; a report that cites an omitted, future, duplicated, unsorted, non-positive, or otherwise invisible sequence is invalid.

Compaction-aware capture bounds obsolete history but does not reconstruct information omitted by the compactor. A reviewer must return `gap` or `uncertain` when the visible projection cannot support a stronger finding.

## Minimal child context

`context: standard` uses normal child composition. `context: minimal` keeps the explicit Shadow prompt, persona, selected model, delegated policy overrides, tool filter, structured-output instruction, Session descriptor, and lifecycle metadata, while suppressing ordinary runtime-context sections and downstream pre-step message additions unrelated to the review.

Minimal context is not a weaker security mode. The child retains the parent's explicit delegated policy and sandbox constraints, and its tools remain limited by the request allowlist. It can remove useful deployment instructions, so it is opt-in per definition.

## Think-first execution

`think_first: true` keeps one child, one run id, one model selection, one AbortSignal, and one disposal lifecycle across two requests:

1. The first request has no tools. The Shadow prompt asks for a numbered plan that names the rendered sequence values it intends to challenge or verify.
2. When that turn settles, the provider steers a plugin-authored continuation into the same child.
3. The second request restores the configured tools and the `structured_output` tool. Only a schema-valid committed call can become the run result.

Cancellation, timeout, parent disposal, or plugin disposal covers both requests. A planning answer alone is never accepted as a report. `think_first: false` keeps the ordinary one-request path.

## Provider capability contract

The plugin reserves the subagent provider name `shadow-mind`. Its built-in provider advertises structured output, depth limit, tool filter, persona, model selection, context inheritance, and think-first support. It creates the child through the parent's published agent factory and reuses DSH composition and policy primitives rather than changing the host loop.

If another plugin registered `shadow-mind` first, Shadow Mind leaves it in place. During run preparation, the runtime checks only the capabilities required by the resolved request. A routed run requires `modelSelection`; minimal context requires `contextInheritance`; think-first requires `thinkFirst`. Missing capability fails the run before provider `start()` and never changes the requested behavior implicitly.

## Deliberation telemetry

After the child settles, the runtime counts text and reasoning stream characters before the first Session `tool/call` named `structured_output` and records the total as `deliberationChars` in process-local status and metadata-only diagnostics. If no such call exists, it counts all recorded assistant chunks. The count includes planning output when think-first is enabled.

This value is diagnostic. It does not affect activation, acceptance, severity, budgets, cooldowns, or value-loop classification. Character length is provider-dependent and can be optimized without improving a finding.

## Verification

Automated coverage rejects invalid definition values and invisible refs, and preserves registry, form, and projection semantics. Real `AgentLoop` scenarios verify that one conditioned child plans without tools, continues with its selected model and tools, returns a structured report, relays durable provenance to the root, and is removed on disposal.
