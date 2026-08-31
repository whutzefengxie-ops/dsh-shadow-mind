/** Shadow report card presentation preferences mirrored from the Host settings document. */

import { useCallback, useSyncExternalStore } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DEFAULT_COLLAPSED_BY_DEFAULT } from '../runtime/types.ts'

/**
 * Settings namespace owning the card presentation preference. The Host runtime
 * registers this namespace as `SHADOW_MIND_SETTINGS_NAMESPACE`; the client
 * bundle must not import the runtime module, so the string is mirrored here.
 */
export const SHADOW_MIND_CARD_SETTINGS_NAMESPACE = 'shadow-mind'

/** Field carrying whether new Shadow report cards start collapsed. */
export const COLLAPSED_BY_DEFAULT_FIELD = 'collapsedByDefault'

/** Card presentation slice resolved from the Shadow Mind settings namespace. */
export interface ShadowCardSettings {
  /** Whether new Shadow report cards start with their report content collapsed. */
  readonly collapsedByDefault: boolean
}

/**
 * Select the collapsed-by-default preference through React's external-store
 * protocol. Falls back to the collapsed default while the Host settings mirror
 * is loading or unavailable, so cards never block on the settings transport.
 * @param scope - the bound Shadow Mind settings namespace scope.
 * @returns the current collapsed-by-default preference.
 */
export function useCardCollapsedByDefault(scope: SettingsScope<ShadowCardSettings>): boolean {
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope])
  const getSnapshot = useCallback(
    () => scope.getSnapshot().value?.collapsedByDefault ?? DEFAULT_COLLAPSED_BY_DEFAULT,
    [scope],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
