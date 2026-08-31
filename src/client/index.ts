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
import { ShadowReviewStore, useShadowMindStatus, useShadowReviewCycle } from './shadow-review-store.ts'
import {
  COLLAPSED_BY_DEFAULT_FIELD,
  SHADOW_MIND_CARD_SETTINGS_NAMESPACE,
  useCardCollapsedByDefault,
  type ShadowCardSettings,
} from './card-preferences.ts'
import { en, zh } from './locales.ts'

export type { ShadowMindSettingsTabInjected, ShadowMindSettingsTabProps } from './ShadowMindSettingsTab.tsx'
export type { ShadowReportCardProps } from './ShadowReportCard.tsx'
export type { ShadowMindReviewChatData } from './shadow-report-projection.ts'
export type { ShadowMindLocaleKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.shadowMind'

/**
 * Session service face the Web shell exposes to client plugins. The Host-typed
 * `ctx.sessions` (`@deepseek-ai/dsh-session`'s SessionStore) is a different
 * static shape, so client callers bridge it structurally, exactly like the
 * harness' own client plugins do through the session-controller contract.
 */
interface ClientSessions {
  /** Resolve one agent-scoped context view for a session id. */
  scope(sessionId: SessionId): ClientContext | undefined
  /** Select one session as current. */
  open(sessionId: SessionId): void
}

/** Bridge `ctx.sessions` to the client session service face. */
function clientSessions(ctx: ClientContext): ClientSessions {
  return ctx.sessions as unknown as ClientSessions
}

/** Services required by the Settings tab, Remote methods, and slash-command acknowledgment. */
export const inject = [
  'slots',
  'locale',
  'sessions',
  'remote',
  'uiConversation',
  'settingsScope',
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

  // One bound Host settings namespace feeds both the review card and the
  // Settings tab. The scope answers the collapsed default while the Host
  // mirror is still loading, and stays unavailable without a settings provider.
  const cardSettings = ctx.settingsScope.bind<ShadowCardSettings>({
    namespace: SHADOW_MIND_CARD_SETTINGS_NAMESPACE,
  })
  const collapsedByDefault = (): boolean => useCardCollapsedByDefault(cardSettings)

  const sessions = clientSessions(ctx)

  ctx.on('command/executed', (sessionId, name, result) => {
    if (name !== 'shadow' || result.text === undefined) return
    const sessionContext = sessions.scope(sessionId)
    const conversation = sessionContext?.get('conversation')
    if (sessionContext === undefined || conversation === undefined) return
    conversation.input.for(sessionContext).notify(result.kind === 'error' ? 'error' : 'info', result.text)
  })

  ctx.inject(['slots', 'remote.shadowMind'], (scope: ClientContext) => {
    const sessions = clientSessions(scope)
    const remote = scope.remote.shadowMind
    const reviewStore = new ShadowReviewStore(
      sessionId => remoteValue<readonly ShadowReviewCycle[]>(
        'shadowMind.cycles',
        remote.cycles(sessionId),
      ),
      sessionId => remoteValue<ShadowMindStatus>(
        'shadowMind.status',
        remote.status(sessionId),
      ),
    )
    scope.effect(() => () => { reviewStore.dispose() }, 'ui-shadow-mind: review lifecycle store')
    scope.uiConversation.events.register(shadowReviewDefinition)
    scope.uiConversation.events.register(shadowRelayMarkerDefinition)
    scope.slots.inject('conversation.chat.node', () => scope.slots.register({
      name: 'conversation.chat.node',
      key: 'shadow-mind-review',
      locale: NS,
      inject: (): ShadowReportCardInjected => ({
        openSession: sessionId => { sessions.open(sessionId) },
        useCycle: (sessionId, capturedThroughSeq) => useShadowReviewCycle(
          reviewStore,
          sessionId,
          capturedThroughSeq,
        ),
        useStatus: sessionId => useShadowMindStatus(reviewStore, sessionId),
        retry: (sessionId, runId) => remoteValue<ShadowMindStatus>(
          'shadowMind.retry',
          remote.retry(sessionId, runId),
        ),
        pause: sessionId => remoteValue<ShadowMindStatus>(
          'shadowMind.pause',
          remote.pause(sessionId),
        ),
        resume: sessionId => remoteValue<ShadowMindStatus>(
          'shadowMind.resume',
          remote.resume(sessionId),
        ),
        poke: sessionId => { reviewStore.poke(sessionId) },
        useCollapsedByDefault: collapsedByDefault,
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
      useCollapsedByDefault: collapsedByDefault,
      setCollapsedByDefault: collapsed => cardSettings.set(COLLAPSED_BY_DEFAULT_FIELD, collapsed),
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
