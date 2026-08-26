# dsh-shadow-mind

[中文](README.zh.md) | English

An independently versioned DeepSeek Harness bundle that starts fresh background Shadow agents after eligible tool-using root turns, validates their structured findings, relays accepted reports into the root session, and exposes configuration and evidence in the Web UI.

## Inspiration

The core design idea for this project comes from [pi-shadow-mind](https://github.com/liuzhengdongfortest/pi-shadow-mind.git). This repository is an independent implementation for the DeepSeek Harness plugin system, not an official fork of that project. Its runtime, Sessions, subagents, permissions, persistence, and Web UI use DeepSeek Harness extension mechanisms.

## Install

The plugin requires DeepSeek Harness `0.1.1-rc.2` or a compatible master build. Pin a reviewed commit when installing from GitHub:

```sh
dsh plugin --profile web add github:whutzefengxie-ops/dsh-shadow-mind#<commit-sha>
```

Install a local checkout during development:

```sh
dsh plugin --profile web add /path/to/dsh-shadow-mind
```

Restart the selected profile after installation. Verify the composed rows without starting the Web server:

```sh
dsh --profile web --dump-config
```

The output must contain `shadow-mind-runtime` and `tool-shadow-mind`. Update by running `add` with a new reviewed SHA. Remove the bundle with:

```sh
dsh plugin --profile web remove @whutzefengxie-ops/dsh-shadow-mind
```

GitHub installation consumes the committed `lib/` directory. This package has no `prepare` script and does not require pnpm `allowBuilds` authorization.

## Configure

Open **Settings → Plugins → Shadow Mind**. The page owns:

- live scheduling settings, including heartbeat probability, parallelism, timeouts, report batching, model route, reasoning effort, disclosure, and size limits;
- Markdown-backed Shadow definitions, including name, activation probability, model filters, execution model, capture window, context inheritance, think-first execution, predicates, holdout mode, tools, and prompt;
- pause, resume, and status controls for the currently selected root session;
- catalog diagnostics and the local definition directory.

Definitions are stored in `$DSH_HOME/shadow-minds/*.md`. A minimal deterministic acceptance definition is:

```markdown
---
id: acceptance-reviewer
name: Acceptance Reviewer
enabled: true
debug: false
activation_probability: 1
active_for_models:
  - '*'
tools: []
capture: since-compaction
context: minimal
think_first: true
---

Review the completed task. If there is a concrete defect or missing requirement, return a concise report with verdict `challenge` or `gap` and only rendered sequence numbers in `refs`. Return `silent` when the review applies but adds nothing actionable, or `not_relevant` when it does not apply.
```

Set the global heartbeat probability to `1` for deterministic acceptance. If `run_with_model` is omitted, the child inherits the root route; set a complete `provider/model` route to use another model. The default Shadow tools are `read`, `grep`, and `glob`; definition tools extend that allowlist and may carry write authority if the inherited sandbox permits it. The disabled starter library under [`examples/shadow-minds/`](examples/shadow-minds/) demonstrates the anchored probe vocabulary and is never installed into `$DSH_HOME` automatically.

## Observe a run

Shadow scheduling requires a completed root turn containing at least one durable tool result. In a new session, ask the root agent to read a repository file and analyze it. `/shadow status` reports pending schedules, active runs, total admitted runs, and the last outcome.

When Shadow scheduling starts, a running placeholder appears immediately below the reviewed root response and warns that sending a new message cancels the review. The same card updates in place to report, silent, not-relevant, aborted, or failed. Repeated reviews remain at their actual turn positions. Report bodies use DSH's Markdown renderer for GFM, tables, code blocks, and TeX with its unsafe-content filtering.

An accepted report becomes a durable root user message and triggers a follow-up, but that relay updates the existing anchored card instead of adding a tail card. `silent`, `not_relevant`, `aborted`, and `failed` remain visible without entering the root agent, so presentation state cannot create a Shadow loop. A `silent` or `not_relevant` output that carries an explanatory body is tolerated: its body text is never relayed, the run settles as the declared status instead of failing validation (only a `report` carries body text), the discarded body is reported through a runtime warning that names the Shadow and run id, and a `non-report-body-discarded` debug record captures its presence, length, and content hash when `debug: true` is set.

Set `debug: true` on a definition when diagnosing production behavior. `$DSH_HOME/shadow-minds/logs/<shadow-id>.jsonl` records admission, child start, cancellation request, terminal outcome, and report delivery with lifecycle stage, stable reason code, cancellation source, and provider stop reason. It excludes prompts, report bodies, tool arguments, credentials, absolute paths, and stacks; a discarded non-report body is represented only by its length and SHA-256 hash. For example, new user input is `USER_MESSAGE_RECEIVED`, a Shadow deadline is `SHADOW_TIMEOUT`, and an abort not attributed to the plugin is `PROVIDER_ABORTED`.

## Security and limitations

The default trajectory projection omits reasoning, raw tool-result text, and tool arguments. Prompt injection remains possible in projected user and assistant text, so tool allowlists, inherited sandbox policy, fixed child approval policy, and disclosure limits remain security controls.

Definitions apply to one Harness home rather than one profile or workspace. Child Sessions follow the Harness persistence policy. Concurrent Shadows do not share a transaction, and write-capable tools can race with the root agent or other Shadows.

This plugin is developed and released from its own repository and is installed into a Harness profile as a bundle. An earlier in-repo copy of the plugin (`packages/shadow-mind` in the Harness source tree) predates this standalone repository and still uses the older `{status, content}` structured-output contract without `verdict`/`severity`/`refs`; it is not part of this repository's build or install path and is not updated here. Fixes in this repository apply to the released bundle only.

Accepted reports and their anchored cards survive a service restart. Runtime counters, the latest-run diagnostic, non-report lifecycle cards, and pause state are current-process data. The current release also resets `spentChars` on restart, so a restart can reopen a configured soft or hard budget before the next real user message.

Follow the [installation and runtime validation plan](docs/installation-runtime-validation.md) for a reproducible source-host deployment, real-model acceptance run, restart checks, and the budget-persistence remediation. See the [target architecture](docs/target-architecture.md), [review conditioning](docs/review-conditioning.md), and [review-quality directions](docs/review-quality-directions.md) for current runtime contracts. The [settings field tiers](docs/settings-ux-analysis.md) document which Web form fields are required, common, advanced, or intentionally not exposed. [The Chinese technical design](docs/technical-design.zh.md) retains the Pi reference analysis and independent release topology. See [SECURITY.md](SECURITY.md) before publishing logs or changing an installation pin.

## Development

```sh
pnpm install
pnpm run check
```

`lib/` is a reviewed release artifact and must be committed whenever source behavior changes. Never commit local Harness state, credentials, sessions, logs, or acceptance exports.
