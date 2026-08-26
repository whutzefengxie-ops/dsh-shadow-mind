# Installation, startup, and runtime validation plan

English | [中文](installation-runtime-validation.zh.md)

This document provides an executable workflow for installing `dsh-shadow-mind` into a DeepSeek Harness source host, starting the Web profile, completing a real-model acceptance run, and verifying restart semantics. Verified behavior and target behavior are identified separately; remediation items are not delivered until their implementation and automated acceptance checks pass.

## 1. Goals and scope

An operator must be able to pin host and plugin versions in an isolated Harness home, prove that the profile loads the GitHub build artifact, observe a complete real DeepSeek root tool turn, Shadow review, report relay, and root follow-up, then inspect persistent data and process state after restarting the same Session.

The plan also addresses two operability gaps: the README lacks an end-to-end source-host workflow, and the settings page plus `/shadow status` do not fully distinguish persistent Session governance from current-process diagnostics. It does not modify DeepSeek Harness, replace its credential system, persist active children, or promise that a force-terminated model request resumes execution.

## 2. Verified baseline

The real-user path completed on 2026-08-26 with the following baseline. Later releases may replace the SHAs, but every acceptance run must record the resolved commits rather than treating movable branch names as release evidence.

| Component | Verified version | Requirement |
| --- | --- | --- |
| DeepSeek Harness | `0.1.1-rc.2`, source commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` | Build from a source checkout and run the `web` profile |
| dsh-shadow-mind | `6a6892860da8d225442c745f84e9b7764e8bbcc5` | Install from a GitHub codeload tarball, not a local link |
| Node.js | `^22.19.0` or `>=24.0.0` | Must satisfy the plugin `engines` field |
| pnpm | `10.15.1` | Matches the plugin package-manager declaration |
| Model credential | `DEEPSEEK_API_KEY` | Inject into the launch process or Harness credential store; never place it in the repository |
| Web server | `http://127.0.0.1:3080` | Inspect and handle an existing listener before startup |

DeepSeek Harness is in developer preview. Compatibility validation should cover both this pinned baseline and the intended Harness commit at release time; a failure on the latter must not overwrite the recorded baseline result.

## 3. Isolated installation workflow

The commands below use Windows PowerShell. Replace every path placeholder with a new absolute path and do not reuse the daily `$DSH_HOME` for acceptance.

### 3.1 Prepare the host, runtime home, and workspace

```powershell
$harnessRepoPath = '<absolute-path-to-new-deepseek-harness-checkout>'
$dshRuntimeHome = '<absolute-path-to-isolated-dsh-home>'
$acceptanceWorkspace = '<absolute-path-to-acceptance-workspace>'
$deepSeekKeyFile = '<absolute-path-to-secret-file>'
$pluginCommit = '6a6892860da8d225442c745f84e9b7764e8bbcc5'

git clone https://github.com/deepseek-ai/deepseek-harness.git $harnessRepoPath
git -C $harnessRepoPath rev-parse HEAD
New-Item -ItemType Directory -Force -Path $dshRuntimeHome, $acceptanceWorkspace | Out-Null

Set-Location $harnessRepoPath
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

The `git rev-parse HEAD` result is the host-version evidence. Check out a reviewed Harness SHA before dependency installation when testing the pinned baseline. When testing the latest default branch, retain the post-clone SHA instead of recording only “latest.”

### 3.2 Inject credentials safely

```powershell
$env:DSH_HOME = $dshRuntimeHome
$env:DEEPSEEK_API_KEY = (Get-Content -LiteralPath $deepSeekKeyFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) {
  throw 'DEEPSEEK_API_KEY is empty'
}
```

The command must not print the variable. Run `Remove-Item Env:DEEPSEEK_API_KEY` in the same shell after acceptance. When the Web provider page stores a credential, Harness writes it to `$DSH_HOME/.credentials.yaml`; that file must not be copied into a repository, log, or acceptance attachment.

### 3.3 Install a pinned plugin commit

```powershell
pnpm dsh plugin --profile web add "github:whutzefengxie-ops/dsh-shadow-mind#$pluginCommit"
```

A successful installation must satisfy all of the following:

1. The dependency specifier in `$DSH_HOME/profiles/web/package.json` equals `github:whutzefengxie-ops/dsh-shadow-mind#<pinned SHA>`, and `dsh.profile.bundles` contains `@whutzefengxie-ops/dsh-shadow-mind`.
2. The resolution in `$DSH_HOME/profiles/web/pnpm-lock.yaml` points to `https://codeload.github.com/.../tar.gz/<SHA>` for the same commit, not `link:` or a local `file:`.
3. The installed package contains the committed `lib/`. This plugin has no `prepare` script, so a GitHub installation does not rebuild source on the user's machine.

Installing the public repository does not require a `gh` login; `gh` is used only for this repository's pull-request workflow. Diagnose pnpm, GitHub network access, and profile content when installation fails. Do not submit plugin code to the DeepSeek Harness upstream repository.

### 3.4 Verify profile composition

```powershell
$composedConfig = pnpm dsh --profile web --dump-config | Out-String
if ($LASTEXITCODE -ne 0) { throw 'web profile composition failed' }
foreach ($requiredRow in @('shadow-mind-runtime', 'tool-shadow-mind')) {
  if (-not $composedConfig.Contains($requiredRow)) {
    throw "missing composed row: $requiredRow"
  }
}
```

Both rows must be present to prove that the runtime and management tool are in the effective boot tree. A package dependency or `node_modules` directory alone does not prove that the plugin will load.

## 4. Startup and shutdown

The Web server listens on `3080` by default. Resolve the listener PID before startup and verify that its command line belongs to the DSH service being replaced:

```powershell
$dshListeners = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
$dshListenerPids = $dshListeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($dshListenerPid in $dshListenerPids) {
  Get-CimInstance Win32_Process -Filter "ProcessId = $dshListenerPid" |
    Select-Object ProcessId, ParentProcessId, Name, CommandLine
}
```

Run `Stop-Process -Id <verified-pid>` only after checking the PID and command line. Never terminate every `node.exe` process by name. Prefer `Ctrl+C` for an old instance owned by the current terminal, then confirm that the port has no listener.

Use the same `DSH_HOME` and credential environment as installation, and launch in the foreground from the Harness checkout:

```powershell
pnpm dsh web --no-open --port 3080
```

Foreground execution exposes startup failures and provides a safe shutdown path. The source launch directory becomes the initial workspace. Create or select `$acceptanceWorkspace` in the Web UI before opening a new Session so the Harness source checkout is not mistaken for the user's project.

## 5. Deterministic real-use scenario

### 5.1 Prepare inspectable workspace input

Create `RELEASE.md` in the acceptance workspace:

```markdown
# Release readiness

The automated tests pass and the deployment artifact is available.

The release checklist does not define rollback triggers or a recovery procedure.
```

### 5.2 Configure Shadow Mind

Open **Settings → Plugins → Shadow Mind** and set the heartbeat probability to `1`. Create the following definition; omitting `run_with_model` makes the child inherit the root route:

```markdown
---
activation_probability: 1
active_for_models:
  - "*"
capture: since-compaction
context: minimal
debug: false
enabled: true
id: acceptance-reviewer
name: Acceptance Reviewer
think_first: true
---

Review the completed root task using the rendered trajectory. When RELEASE.md says the checklist lacks rollback triggers and a recovery procedure, return status "report", content exactly "Release readiness is blocked: RELEASE.md explicitly omits rollback triggers and a recovery procedure.", verdict "gap", severity 0.9, and refs containing only the rendered seq of the root assistant answer. Do not use tools. Do not return silent or not_relevant for this condition.
```

The saved definition must have no parse diagnostic. Preserve `capture: since-compaction`, `context: minimal`, and `think_first: true` to exercise anchored capture, minimal context, and same-child think-then-structured-output behavior. Set `debug` temporarily to `true` when lifecycle diagnostics are needed; the resulting log still must not contain prompts, report bodies, tool arguments, credentials, or absolute paths.

### 5.3 Run a real model task

Send the following in a new Session:

> Use the `read` tool to read `RELEASE.md` and determine whether it is ready for release. Base the answer only on the file.

The root must produce a durable `tool/result`; a textual claim that it read the file does not qualify. Do not send another message after the Shadow card appears because real user input cancels the review.

### 5.4 Acceptance criteria

A complete acceptance run must satisfy every item:

- the root completes `read` through a real DeepSeek route;
- a Shadow `Reviewing` card appears below the reviewed root response and updates in place to `Report`;
- the report body equals the required release-readiness gap and carries valid anchored `refs`;
- the accepted report is persisted in the root Session with `shadow-report` provenance and triggers a root follow-up;
- `/shadow status` shows zero active and pending work after completion, at least one run, and the latest relay outcome;
- `think_first` telemetry reports `deliberationChars` greater than zero and a route matching the expected model selection;
- the browser console contains no plugin, Typert, Remote, React, or resource-loading error.

The verified baseline produced one `gap` relay, a root follow-up, `deliberationChars=5406`, `same_vendor`, and the `deepseek-official/deepseek-v4-flash` route. These values describe one run and are not fixed thresholds across models.

## 6. Restart and persistence acceptance

Wait until the root follow-up and Shadow batcher are fully idle, record `/shadow status`, stop the server with `Ctrl+C`, confirm that `3080` is free, and restart with the same Harness checkout, `DSH_HOME`, workspace, and credential. Resume the original Session and inspect the settings page, conversation card, and `/shadow status` before sending any new user message.

The current implementation behaves as follows:

| Data | Current behavior after restart | Product semantics |
| --- | --- | --- |
| Global settings and Markdown definitions | Preserved | Persistent configuration |
| Accepted report, `shadow-report` provenance, anchored Report card | Preserved | Persistent Session fact |
| active, pending, non-report terminal cycles, pause | Cleared | Current-process control state |
| `totalRuns`, `lastRun`, `prefilterSkips`, `recentReviews`, value-loop, and synthesis counters | Cleared | Current-process diagnostics; UI and command output must name the scope |
| `spentChars` and budget tier | Cleared to `0`/`standard` | Violates the “since the latest real user message” budget promise and requires remediation |

The verified Session reported `1 total runs`, `2363 chars`, and one recent report before restart. The definition, durable report, and relay marker remained afterward, while status changed to `0 total runs`, `0 chars`, zero recent reports, and no `lastRun`. Resetting process metrics agrees with the internal type descriptions; resetting `spentChars` lets a service restart bypass the soft and hard limits.

## 7. Runtime-state remediation design

### 7.1 State classification

The following three classes must be exposed consistently in the UI, Remote types, `/shadow status`, and README:

1. **Persistent Session facts:** accepted relays and provenance, plus anchored Report cards recoverable from the Session log.
2. **Persistent governance state:** `spentChars` and the budget tier for the current root since the latest real user message. A service restart is not a user message and must not reset them.
3. **Current-process diagnostics and controls:** active, pending, pause, run cycles, `totalRuns`, `lastRun`, prefilter, value-loop, recent-review projection, cooldown, escalation, and synthesis counters. They may reset, but every presentation must say “current process.”

This remediation does not restore an active child or non-report card as executable work. Process termination ends those lifecycles; restart recovers only persistent facts and budget governance.

### 7.2 Durable budget governance

The compatible baseline has no public API that lets an out-of-tree plugin safely append a custom `ignorable` Session event. Writing an unknown Session event directly would prevent Harness without this plugin from restoring the Session. The first implementation phase therefore uses a plugin-owned, metadata-only sidecar:

```text
$DSH_HOME/shadow-minds/governance/<sha256-of-root-session-id>.json
```

The filename uses the SHA-256 of the root Session id. Its versioned contents include at least `schemaVersion`, `rootSessionId`, the durable sequence of the latest real user message, `spentChars`, stable debit ids for the current epoch, and an update time. It must not contain prompts, report bodies, tool arguments, model responses, or credentials. Writes use the existing atomic-write capability, serialize updates, and atomically replace the file. New POSIX files request `0600`; operators own Windows ACLs.

The owner loads this state asynchronously on first use, and `scheduleTurn` must wait for loading before checking the budget or admitting work. Without a configured budget, a store failure retains an explicit diagnostic and continues with the process-local counter. With a soft or hard budget, a read, version-validation, or write failure enters an explicit governance-error state and blocks new reviewer and synthesizer work instead of failing open as `0`. Enabling a budget must first persist the current epoch's in-memory counter. Admitted work may settle, but new spend waits for durable state recovery.

Budget updates use a write-ahead rule: after a prompt is built and admitted, persist its character debit before starting the provider; after a structured report validates, persist its report-character debit before entering the batcher. Reviewer and synthesizer debits use stable identifiers so an in-process retry cannot charge twice. Every debit compares its budget epoch so a late result from an older epoch cannot write into the current one. A new real user message still opens a new budget epoch, but the reset commits only after its durable `user/message` sequence is known. Restart only loads the existing epoch.

If Harness later exposes an `ignorable` metadata-event API to out-of-tree plugins, the same versioned record may move into the Session log. Until a migration is implemented, the sidecar remains authoritative and values from two sources must never be added together.

### 7.3 Presentation and commands

The settings page labels `totalRuns`, `lastRun`, `recentReviews`, and similar values as “current-process total runs,” “current-process latest Shadow,” and “current-process recent reports.” `spentChars` becomes “characters spent since the latest real user message” and exposes `disabled`, `loading`, `ready`, or `error` persistence state.

`/shadow status` uses the same grouping so `0 total runs` cannot be read as proof that the Session never had a Shadow. Persistent Report cards remain the history evidence; the command reports current-process runtime metrics and the restored current budget epoch.

## 8. Implementation order and tests

### Phase A: documentation and scope

- publish this plan and its README entry;
- name current-process counters, durable reports, and the budget restart gap;
- require pinned host and plugin SHAs in upgrade evidence.

Verify Markdown links, bilingual pairing, secret and absolute-path scans, and `git diff --check`.

### Phase B: governance storage

- add an independent governance store with version validation;
- connect reviewer and synthesizer prompt/report debits to serialized atomic updates;
- commit a new budget epoch at the durable real-user message;
- add fail-closed state and a stable reason code for read or write failure.

Verify missing-file initialization, same-epoch recovery, new-user reset, duplicate debit handling, corrupt and unknown-version rejection, concurrent writes, soft-budget `frugal` preservation, hard-budget `exhausted` preservation, and no over-budget provider call after restart.

### Phase C: runtime and Web semantics

- expose governance loading state through the status Remote;
- label every process-scoped field in the UI and `/shadow status`;
- preserve existing anchored relay recovery without inventing cycles for terminated work.

Verify focused runtime tests, command-output tests, Web component tests, and an assembled AgentLoop restart scenario. Synchronize every user-visible string in Chinese and English.

### Phase D: release acceptance

- run `pnpm run check` and built-artifact smoke against the release tarball;
- install into a fresh `DSH_HOME` and execute Sections 3–6 with a real model;
- restart separately in `standard`, `frugal`, and `exhausted` states and prove that spend does not decrease;
- send a new real user message and prove that only this event resets the budget epoch;
- inspect browser errors, lifecycle diagnostics, and repository secret scans.

The README restart limitation can be removed only after both the automated restart scenario and real-model acceptance pass.

## 9. Troubleshooting

| Symptom | Check first | Action |
| --- | --- | --- |
| `plugin add` fails | Node/pnpm versions, GitHub codeload access, target `DSH_HOME` | Retain complete stderr; public installation does not need `gh auth` |
| `dump-config` lacks one or both rows | Same `DSH_HOME` and `web` profile, manifest bundle, lockfile SHA | Run `add` again with the pinned SHA; do not edit `node_modules` |
| Web has no Shadow Mind settings page | Restart after installation, client manifest, browser console | Prove both composed rows first, then diagnose client loading |
| Root responds but no Shadow runs | Durable root tool result, heartbeat, definition probability, model filter, pause, hard budget, definition diagnostic | Isolate each condition with the deterministic definition before raising concurrency |
| Shadow runs but no relay arrives | report terminal state, output validation, user-message cancellation, epoch change, batcher state | Inspect the card reason code; only `report` enters the root |
| Report card disappears after restart | A relay was persisted with `shadow-report` provenance | Non-report cards are process-local; a missing Report is a regression |
| Budget is zero after restart | Governance sidecar, supported version, loading state | This is a known gap before remediation; afterward it must fail closed and report an error |
| Model returns an authorization error | Launch process inherited `DEEPSEEK_API_KEY` or a Harness credential reference | Do not print the key; repair the environment and restart |

## 10. Upgrade, rollback, and cleanup

Upgrade by running `plugin add` again with a newly reviewed SHA, verifying the manifest, lockfile, and `dump-config`, then restarting. Roll back by installing the last accepted SHA with the same command; never edit the profile lockfile directly.

The governance sidecar uses a dedicated path, and plugin releases without governance-store support ignore it, so a code rollback does not require deletion. For a full uninstall, first run:

```powershell
pnpm dsh plugin --profile web remove @whutzefengxie-ops/dsh-shadow-mind
```

Uninstall does not automatically delete definitions, logs, holdout keys, or governance sidecars. An operator may manually clean `$DSH_HOME/shadow-minds/` only after resolving the exact isolated `DSH_HOME` and taking required backups. Never recursively delete an unresolved environment-variable path or a home root.
