# Shadow Mind target architecture

English | [中文](target-architecture.zh.md)

This reference describes the architecture implemented by the independently versioned `@whutzefengxie-ops/dsh-shadow-mind` bundle. The bundle installs into DeepSeek Harness through public plugin, Session, subagent, settings, tool, Typert, and client extension points; it does not patch the Harness repository or `agent-loop`.

## Runtime topology

The package exposes the runtime from its root entry, administration tools and `/shadow` from `./tool`, browser integration from `./client`, generated Remote descriptions from `./typert`, and profile composition from `cordis.patch.yml`. Runtime definitions live under `$DSH_HOME/shadow-minds/*.md`; the disabled starter definitions under [`examples/shadow-minds/`](../examples/shadow-minds/) are package content and are never copied or enabled automatically.

The runtime is split into five responsibilities:

1. The trigger path owns eligible tool-turn detection, the single probability roll for the `default` definition, decay, cooldowns, escalation, and Session character budgets.
2. The run path owns trajectory capture, context inheritance, think-first execution, model selection, tool restrictions, inherited policies, timeout, cancellation, and fresh-child disposal.
3. The output path owns structured result capture, `verdict`, `severity`, `refs`, report validation, holdout replacement, batch ordering, and durable relay provenance.
4. The coordination path owns bounded review metadata and stagnation detection.
5. The governance path owns process-local status, anchored Web cards, local diagnostic journals, value-loop classification, and teardown to quiescence.

The [conditioning reference](review-conditioning.md) defines `capture`, `context`, `think_first`, and `deliberationChars`. The [quality reference](review-quality-directions.md) defines the mechanisms layered over the scheduler (D2 predicates and D6 synthesis are removed; see the [rework plan](settings-ux-revamp.md)).

## Anchored review model

Every admitted Shadow is a fresh child with an explicit root-event watermark. Rendered trajectory entries carry their durable Session sequence, and a report may reference only sequences present in its exact projection. This provides anchored findings, not proof of omitted data, inaccessible artifacts, or hidden reasoning.

A report has one of four epistemic verdicts: `challenge`, `gap`, `confirm`, or `uncertain`. Optional `severity` orders reports within one relay; it is not a quality score that can be compared across providers. `refs` is an ascending unique list of at most eight visible positive Session sequences.

Accepted reports become ordinary durable `user/message` events with `shadow-report` provenance. The provenance records the definition, run, child Session, capture watermark, verdict, refs, and optional severity. Running, quiet, irrelevant, aborted, and failed states remain process-local and update the card anchored at the reviewed `turn/end`; they never create custom Session events or model-visible pseudo-reports.

## Dedicated child provider

The runtime starts reviewers through the provider name `shadow-mind`. When that name is free, the plugin registers its own in-process provider using published DSH child creation, policy inheritance, model selection, tool, system-prompt, Session, and disposal APIs. The provider creates one fresh child for each run and owns its prompt, AbortSignal handoff, result settlement, and quiescent disposal.

Deployments may pre-register a provider with the same name. The plugin does not overwrite it. Before each request, the runtime checks the capabilities needed by that request—`modelSelection`, `contextInheritance`, and `thinkFirst`—and fails the run explicitly when the provider cannot preserve them. Conditioning never silently degrades to ordinary spawn behavior.

## Spend, coordination, and cancellation

The single `default` definition is admitted by one probability roll per eligible turn; at most one reviewer runs per root at a time. Review-window detections can install a wall-clock cooldown or reserve one higher configured reasoning-effort rung. Prompt and accepted-report characters accumulate per root: a configured soft limit selects the frugal route, while a hard limit prevents new reviewer work without cancelling work already admitted.

Real user input, user turn cancellation, pause, root disposal, plugin disposal, or headless cancellation advances the owner epoch. Active children receive cancellation, and every validated report still waiting in the batcher is converted to an aborted relay-stage outcome. Delivery rechecks the exact root identity and epoch before entering the inbox.

## Security and diagnostic authority

The projection omits reasoning and raw tool-result bodies; tool arguments are redacted by default. Tool allowlists, inherited sandbox policy, and fixed delegated approval behavior remain the enforcement controls because projected user and assistant text can still contain prompt injection.

Holdout mode performs exact literal replacement using operator-protected `$DSH_HOME/shadow-minds/holdout-keys.json`. The plugin validates the data but leaves file permissions and Windows ACLs to the deployment. It covers owned model-visible paths and the complete relay assertion, but it is not a filesystem sandbox and cannot detect paraphrases. Child Sessions continue to follow ordinary Harness persistence policy.

Lifecycle debug files and `value-loop.jsonl` contain metadata rather than trajectory or report text. Value-loop classifications describe whether later durable activity appears to adopt, reject, or ignore a challenge. They never tune probability, gate a report, reward a model, or change scheduling.

## Implementation and verification

Runtime orchestration lives in `src/runtime/`; administration lives in `src/tool/`; browser settings and anchored cards live in `src/client/`; starter personas live in `examples/shadow-minds/`. Automated coverage validates each isolated mechanism and its failure cases. The assembled `AgentLoop` scenario loads the `default` definition and verifies root tool use, same-child think-first continuation, minimal context, model routing, structured output, durable relay provenance, follow-up, and disposal.
