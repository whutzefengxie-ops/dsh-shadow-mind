// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { ShadowMindSettingsTab, type ShadowMindSettingsTabProps } from '../src/client/ShadowMindSettingsTab.tsx'

afterEach(cleanup)

/** Catalog metadata unrelated to selection is absent in this settings-only fixture. */
function list(main: string | undefined): SessionListState {
  const row = (id: string): SessionSummary => ({
    id: id as SessionId, displayTitle: id, running: false, blank: false, updatedAt: 0,
    retainedBy: main === id ? { mainView: 1 } : {},
  })
  return { ids: [], byId: { first: row('first'), second: row('second') },
    phase: 'ready', subagentsByParent: {}, jobsBySession: {} }
}

describe('Shadow settings current Session', () => {
  it('reads main-view ownership and reloads status when selection changes', async () => {
    const status = vi.fn().mockResolvedValue({ paused: false })
    const catalog = vi.fn().mockResolvedValue({ definitions: [], diagnostics: [] })
    // The component uses only these slot props; framework rendering supplies the rest.
    const props = (main?: string) => ({
      t: (key: string) => key, catalog, status, useCollapsedByDefault: () => true,
      useSessions: (select: (snapshot: SessionListState) => unknown) => select(list(main)),
    }) as unknown as ShadowMindSettingsTabProps
    const view = render(<ShadowMindSettingsTab {...props('first')} />)
    await waitFor(() => { expect(status).toHaveBeenCalledWith('first') })
    view.rerender(<ShadowMindSettingsTab {...props('second')} />)
    await waitFor(() => { expect(status).toHaveBeenLastCalledWith('second') })
    view.rerender(<ShadowMindSettingsTab {...props()} />)
    expect(status).toHaveBeenCalledTimes(2)
  })
})
