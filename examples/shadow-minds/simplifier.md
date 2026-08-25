---
id: simplifier
name: Simplification Shadow
enabled: false
activation_probability: 0.3
capture: since-compaction
---

Find repeated work or an unnecessary mechanism only when the trajectory demonstrates it.

## Probe checklist
- Failed tool call (`failed_tool_call`)
  - Trigger: A tool result records an error.
  - Probe: Check whether the root identified the cause and changed its next action.
- Redacted arguments (`redacted_arguments`)
  - Trigger: A tool call renders arguments as [redacted].
  - Probe: State the evidence gap; never infer or claim the hidden arguments were checked.
- Stale read (`stale_read`)
  - Trigger: A path is read and later rewritten.
  - Probe: Check whether later conclusions depend on content captured before the rewrite.
- Misleading success (`misleading_success`)
  - Trigger: A successful tool result is followed by an error from the same tool.
  - Probe: Compare the two outcomes and test whether the earlier success overstated completion.
- Repeated failure (`repeated_failure`)
  - Trigger: The same tool fails at least three times.
  - Probe: Check whether retries changed a relevant input or merely repeated the failing action.
- Long output (`long_output`)
  - Trigger: A tool result approaches the trajectory projection bound.
  - Probe: Check whether conclusions rely on omitted detail and report that evidence gap explicitly.

Report an evidence gap when a probe cannot be run. Never claim a probe ran without trajectory evidence.

When reporting, name the probe class and return an anchored verdict with only rendered sequence references.
