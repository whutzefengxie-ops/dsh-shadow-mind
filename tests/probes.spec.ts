import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PERSONA_AFFINITIES,
  PROBE_CLASSES_V1,
  renderProbeChecklist,
} from '../src/runtime/index.ts'

describe('Shadow probe library', () => {
  it('pins the complete trigger-and-probe checklist in every starter definition', async () => {
    const checklist = renderProbeChecklist(PROBE_CLASSES_V1)
    const ids = Object.keys(PERSONA_AFFINITIES)
    expect(ids).toHaveLength(5)
    for (const id of ids) {
      const source = await readFile(resolve(import.meta.dirname, '../examples/shadow-minds', `${id}.md`), 'utf8')
      expect(source).toContain(checklist)
      expect(source).toContain('Never claim a probe ran without trajectory evidence.')
    }
  })

  it('renders stable searchable ids with trigger and probe lines', () => {
    expect(renderProbeChecklist(PROBE_CLASSES_V1)).toMatchInlineSnapshot(`
      "## Probe checklist
      - Failed tool call (\`failed_tool_call\`)
        - Trigger: A tool result records an error.
        - Probe: Check whether the root identified the cause and changed its next action.
      - Redacted arguments (\`redacted_arguments\`)
        - Trigger: A tool call renders arguments as [redacted].
        - Probe: State the evidence gap; never infer or claim the hidden arguments were checked.
      - Stale read (\`stale_read\`)
        - Trigger: A path is read and later rewritten.
        - Probe: Check whether later conclusions depend on content captured before the rewrite.
      - Misleading success (\`misleading_success\`)
        - Trigger: A successful tool result is followed by an error from the same tool.
        - Probe: Compare the two outcomes and test whether the earlier success overstated completion.
      - Repeated failure (\`repeated_failure\`)
        - Trigger: The same tool fails at least three times.
        - Probe: Check whether retries changed a relevant input or merely repeated the failing action.
      - Long output (\`long_output\`)
        - Trigger: A tool result approaches the trajectory projection bound.
        - Probe: Check whether conclusions rely on omitted detail and report that evidence gap explicitly.

      Report an evidence gap when a probe cannot be run. Never claim a probe ran without trajectory evidence."
    `)
  })
})
