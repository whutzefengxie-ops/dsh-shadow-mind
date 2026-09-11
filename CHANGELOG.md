# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
