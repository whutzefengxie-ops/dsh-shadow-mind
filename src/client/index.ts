/** Shadow Mind Web administration registered under Settings → Plugins. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import shadowMindRemote from '../generated/typert.remote-client.js'
import type {
  ShadowAdministrationSnapshot,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindStatus,
  ShadowReviewCycle,
} from '../runtime/types.ts'
import {
  ShadowMindSettingsTab,
  type ShadowMindSettingsTabInjected,
} from './ShadowMindSettingsTab.tsx'
import {
  ShadowRelayMarker,
  ShadowReportCard,
  type ShadowReportCardInjected,
} from './ShadowReportCard.tsx'
import {
  shadowRelayMarkerDefinition,
  shadowReviewDefinition,
} from './shadow-report-conversation.ts'
import { ShadowReviewStore, useShadowReviewCycle } from './shadow-review-store.ts'
import { en, zh } from './locales.ts'

export type { ShadowMindSettingsTabInjected, ShadowMindSettingsTabProps } from './ShadowMindSettingsTab.tsx'
export type { ShadowReportCardProps } from './ShadowReportCard.tsx'
export type { ShadowMindReviewChatData } from './shadow-report-projection.ts'
export type { ShadowMindLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.shadowMind'

/** Services required by the Settings tab, Remote methods, and slash-command acknowledgment. */
export const inject = [
  'slots',
  'locale',
  'sessions',
  'remote',
  'uiConversation',
]

/** Unwrap one generated Remote business result. */
async function remoteValue<T>(
  operation: string,
  request: Promise<{ ok: true; value: T } | { ok: false; error: { code: string; message: string } }>,
): Promise<T> {
  const result = await request
  if (!result.ok) throw new Error(`${operation} failed: ${result.error.code}: ${result.error.message}`)
  return result.value
}

/** Mount the Shadow Mind Settings tab and visible slash-command acknowledgment. */
export async function apply(ctx: ClientContext): Promise<void> {
  const unmountRemote = await ctx.remote.$mount(shadowMindRemote)
  ctx.effect(() => unmountRemote, 'ui-shadow-mind: remote contribution')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-shadow-mind: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.on('command/executed', (sessionId, name, result) => {
    if (name !== 'shadow' || result.text === undefined) return
    const sessionContext = ctx.sessions.scope(sessionId)
    const conversation = sessionContext?.get('conversation')
    if (sessionContext === undefined || conversation === undefined) return
    conversation.input.for(sessionContext).notify(result.kind === 'error' ? 'error' : 'info', result.text)
  })

  ctx.inject(['slots', 'remote.shadowMind'], (scope: ClientContext) => {
    const remote = scope.remote.shadowMind
    const reviewStore = new ShadowReviewStore(sessionId => remoteValue<readonly ShadowReviewCycle[]>(
      'shadowMind.cycles',
      remote.cycles(sessionId),
    ))
    scope.effect(() => () => { reviewStore.dispose() }, 'ui-shadow-mind: review lifecycle store')
    scope.uiConversation.events.register(shadowReviewDefinition)
    scope.uiConversation.events.register(shadowRelayMarkerDefinition)
    scope.slots.inject('conversation.chat.node', () => scope.slots.register({
      name: 'conversation.chat.node',
      key: 'shadow-mind-review',
      locale: NS,
      inject: (): ShadowReportCardInjected => ({
        openSession: sessionId => { scope.sessions.open(sessionId) },
        useCycle: (sessionId, capturedThroughSeq) => useShadowReviewCycle(
          reviewStore,
          sessionId,
          capturedThroughSeq,
        ),
        retry: (sessionId, runId) => remoteValue<ShadowMindStatus>(
          'shadowMind.retry',
          remote.retry(sessionId, runId),
        ),
        poke: sessionId => { reviewStore.poke(sessionId) },
      }),
    }, ShadowReportCard))
    scope.slots.inject('conversation.chat.node', () => scope.slots.register({
      name: 'conversation.chat.node',
      key: 'shadow-mind-relay-marker',
    }, ShadowRelayMarker))
    const injected = (): ShadowMindSettingsTabInjected => ({
      saveDefault: input => remoteValue<ShadowDefinition>('shadowMind.saveDefault', remote.saveDefault(input)),
      catalog: () => remoteValue<ShadowAdministrationSnapshot>('shadowMind.catalog', remote.catalog()),
      status: sessionId => remoteValue<ShadowMindStatus>('shadowMind.status', remote.status(sessionId)),
    })

    scope.slots.inject('settings.plugins.tab', () => scope.slots.register({
      name: 'settings.plugins.tab',
      id: 'shadow-mind',
      order: 5,
      label: () => t('tab'),
      locale: NS,
      inject: injected,
    }, ShadowMindSettingsTab))
  })
}

/** Preserve the generated scoped Agent identifier type at the client boundary. */
export type ShadowMindSessionId = SessionId
/** Preserve the editable wire input in the browser bundle's public declaration. */
export type ShadowMindDefinitionInput = ShadowDefinitionInput
