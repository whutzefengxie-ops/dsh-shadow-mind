# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-09-20

### Release
- Republish the DSH `0.1.6-alpha.2` compatibility fix under a new immutable tag. Runtime source and committed `lib/` artifacts are identical to v0.1.3.
- Update package metadata and installation instructions to v0.1.4.

## [0.1.3] - 2026-09-20

### Fixed
- Host and Client RPC descriptors provide the `create()` codec factories required by DSH `0.1.6-alpha.2`, allowing the Shadow client to activate.
- Settings read the Session retained by the main view; report cards open child Sessions through `uiWorkspace.openSession`.

### Compatibility
- The development baseline is DSH `0.1.6-alpha.2` at `ddefc45fbc7f8e46dd73185e68295696d1297887`. Earlier DSH APIs are unsupported by this checkout.
- Regression tests register both Typert contributions and activate the shipped browser bundle with the current Client gateway.

## [0.1.2] - 2026-09-14

### Fixed
- **Subagent startup never failed on unpublished setup again**: the degenerate-output
  watchdog no longer resolves the child through `ctx.agents` while setup runs. The agent
  factory awaits setup BEFORE inserting or announcing the session or agent, so that lookup
  always returned `undefined` and every Shadow run died at the `start` stage with
  `SUBAGENT_START_FAILED` / `Shadow child agent <id> not found`. The watchdog now receives
  the Agent that setup itself is handed, which is the only correct binding before
  publication. (Introduced by the v0.1.1 session-API compatibility change.)
- **Live degenerate-output detection restored**: the watchdog consumes the process-local
  `agent/assistant-stream` chunk frames instead of the durable `assistant/attempt` event.
  The durable attempt event only lands after the whole attempt has streamed, so a runaway
  repetition loop or output flood was never cancelled in flight.
- **Client bundle builds against the current Harness**: `@deepseek-ai/dsh-brand`, the
  stateless branded-primitive layer that `@deepseek-ai/dsh-session` now imports, is inlined
  by the browser bundle instead of being rejected by the client-bundle purity gate.

### Changed
- Test fixtures updated for the current Session API: `session.snapshotEvents()`,
  `SessionSeq`-branded compaction ranges, `assistant/message` fixtures carrying their
  `stream`, `await ctx.agentLoop.create(...)`, and child stubs exposing `session.header`
  plus `snapshotEvents()`.
- Regenerated the committed typert artifacts (descriptor `sourceLocation` lines had
  drifted from `src/runtime/index.ts`).

### Compatibility
- Validated against the DeepSeek Harness `master` checkout (`0.1.5-rc.2`).
- `pnpm run check` is green: 214 tests, host + client typecheck, host and browser bundles,
  and the bundle smoke check.

## [0.1.1] - 2026-09-10

### Fixed
- **Session API Compatibility**: Updated for DSH v0.1.5+ session API changes
  - Replaced deprecated `session.events` with `session.snapshotEvents()`
  - Updated `assistant/chunk` event handling to use `assistant/attempt` with stream records
  - Fixed `Context.agent` access patterns (now uses `agents.get()` or event parameters)
  - Updated `settingsNamespace` import to use `SettingsNamespace` type
  - Fixed `CommandInputDescriptor`: replaced `images` field with `attachments`
  - Fixed `childSessionMeta` call signature (third parameter is boolean)

### Compatibility
- **Requires DSH**: `>=0.1.5-rc.1 <0.2.0`
- **Peer Dependencies**: 
  - `@deepseek-ai/dsh-agent`: `>=0.1.1-rc.2 <0.2.0`
  - `@deepseek-ai/dsh-session`: `>=0.1.1-rc.2 <0.2.0`
  - `@deepseek-ai/dsh-subagent`: `>=0.1.2-alpha.1 <0.2.0`
  - All other dsh packages: `>=0.1.1-rc.2 <0.2.0`

### Breaking Changes
- This version is **not compatible** with DSH versions earlier than `0.1.5-rc.1` due to Session API changes
- If you're using an older DSH version, please use `dsh-shadow-mind@0.1.0`

## [0.1.0] - 2024-09-01

### Initial Release
- First public release of DSH Shadow Mind plugin
- Probabilistic background Shadow agent reviews
- Support for `/shadow new` command
- Collapsible report cards in UI
- Compatible with DSH `0.1.4` and earlier
