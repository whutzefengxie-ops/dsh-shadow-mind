// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  useCardCollapsedByDefault,
  type ShadowCardSettings,
} from '../src/client/card-preferences.ts'

afterEach(() => {
  cleanup()
})

/** Minimal external store mirroring the settings scope contract. */
function stubScope(initial: ShadowCardSettings | undefined) {
  const listeners = new Set<() => void>()
  let snapshot = { value: initial }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next: ShadowCardSettings | undefined) {
      snapshot = { value: next }
      for (const listener of listeners) listener()
    },
  }
}

describe('useCardCollapsedByDefault', () => {
  it('falls back to collapsed while the Host settings mirror is loading', () => {
    const scope = stubScope(undefined)
    const { result } = renderHook(() => useCardCollapsedByDefault(scope as unknown as SettingsScope<ShadowCardSettings>))
    expect(result.current).toBe(true)
  })

  it('reflects the persisted preference and live changes', () => {
    const scope = stubScope({ collapsedByDefault: false })
    const { result } = renderHook(() => useCardCollapsedByDefault(scope as unknown as SettingsScope<ShadowCardSettings>))
    expect(result.current).toBe(false)

    act(() => { scope.set({ collapsedByDefault: true }) })
    expect(result.current).toBe(true)
  })
})
