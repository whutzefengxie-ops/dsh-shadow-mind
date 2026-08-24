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
- Markdown-backed Shadow definitions, including name, activation probability, model filters, execution model, tools, and prompt;
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
---

Review the completed task. If there is a concrete defect or missing requirement, return a concise report with evidence. Otherwise return not_relevant.
```

Set the global heartbeat probability to `1` for deterministic acceptance. If `run_with_model` is omitted, the child inherits the root route; set a complete `provider/model` route to use another model. The default Shadow tools are `read`, `grep`, and `glob`; definition tools extend that allowlist and may carry write authority if the inherited sandbox permits it.

## Observe a run

Shadow scheduling requires a completed root turn containing at least one durable tool result. In a new session, ask the root agent to read a repository file and analyze it. `/shadow status` reports pending schedules, active runs, total admitted runs, and the last outcome.

An accepted report becomes a durable root user message and triggers a follow-up. The Web transcript renders a Shadow report card at that relay message, between the reviewed root response and the resulting follow-up. Each batch has its own card with the definition, report text, captured sequence, and child Session link, so repeated Shadow reviews remain in chronological order. Silent, not-relevant, failed, cancelled, and stale runs do not inject partial text.

## Security and limitations

The default trajectory projection omits reasoning, raw tool-result text, and tool arguments. Prompt injection remains possible in projected user and assistant text, so tool allowlists, inherited sandbox policy, fixed child approval policy, and disclosure limits remain security controls.

Definitions apply to one Harness home rather than one profile or workspace. Child Sessions follow the Harness persistence policy. Concurrent Shadows do not share a transaction, and write-capable tools can race with the root agent or other Shadows.

See [the technical design](docs/technical-design.zh.md) for the Pi reference analysis, DSH architecture, lifecycle, and deliberate differences. See [SECURITY.md](SECURITY.md) before publishing logs or changing an installation pin.

## Development

```sh
pnpm install
pnpm run check
```

`lib/` is a reviewed release artifact and must be committed whenever source behavior changes. Never commit local Harness state, credentials, sessions, logs, or acceptance exports.
