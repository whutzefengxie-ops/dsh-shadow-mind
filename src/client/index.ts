/** Shadow Mind Web administration registered under Settings → Plugins. */

import type { ConnectionHandle, IApiClient, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext, SessionId, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import shadowMindRemote from '../generated/typert.remote-client.js'
import type {
  ShadowAdministrationSnapshot,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindSettings,
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
const SETTINGS_NAMESPACE = 'shadow-mind'

/** Services required by the Settings tab, Remote methods, and slash-command acknowledgment. */
export const inject = [
  'connection',
  'slots',
  'locale',
  'sessions',
  'remote',
  'settingsScope',
  'conversationEvents',
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

/** Atomically persist changed fields and removed overrides against one namespace revision. */
async function saveSettings(
  scope: SettingsScope<ShadowMindSettings>,
  api: Pick<IApiClient, 'settings'>,
  next: ShadowMindSettings,
): Promise<void> {
  const snapshot = scope.getSnapshot()
  if (!snapshot.writable || snapshot.status !== 'ready' || snapshot.value === undefined) {
    throw new Error('Shadow Mind settings are not writable')
  }
  const current = snapshot.value
  const user = snapshot.user
  const optionalFields = [
    'defaultShadowModel',
    'defaultReasoningEffort',
    'defaultAgentPreset',
    'randomSeed',
    'sessionShadowSoftBudgetChars',
    'sessionShadowHardBudgetChars',
    'frugalShadowModel',
    'synthesisModel',
    'synthesisReasoningEffort',
    'synthesisAgentPreset',
    'commandGateContext',
    'commandGateModel',
    'commandGateReasoningEffort',
    'commandGateAgentPreset',
  ] as const satisfies readonly (keyof ShadowMindSettings)[]
  const ops: SettingsPathOpView[] = []
  for (const [field, value] of Object.entries(next)) {
    const key = field as keyof ShadowMindSettings
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      ops.push({ op: 'set', path: [key], value })
    }
  }
  for (const field of optionalFields) {
    if (!Object.hasOwn(next, field)
      && typeof user === 'object' && user !== null && Object.hasOwn(user, field)) {
      ops.push({ op: 'unset', path: [field] })
    }
  }
  if (ops.length === 0) return
  const response = await api.settings.mutate({
    ns: SETTINGS_NAMESPACE,
    ops,
    ...snapshot.revision === undefined ? {} : { expectedRevision: snapshot.revision },
  })
  if (!response.result.ok) {
    throw new Error(
      `Shadow Mind settings save failed: ${response.result.error.code}: ${response.result.error.message}`,
    )
  }
}

/** Mount the Shadow Mind Settings tab and visible slash-command acknowledgment. */
export async function apply(ctx: ClientContext): Promise<void> {
  const connection = ctx.get('connection') as ConnectionHandle
  const unmountRemote = await ctx.remote.$mount(shadowMindRemote)
  ctx.effect(() => unmountRemote, 'ui-shadow-mind: remote contribution')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-shadow-mind: dictionaries')
  const t = ctx.locale.bind(NS)
  const settings = ctx.settingsScope.bind<ShadowMindSettings>({ namespace: SETTINGS_NAMESPACE })

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
    scope.effect(() => scope.conversationEvents.register(shadowReviewDefinition), 'ui-shadow-mind: review projection')
    scope.effect(
      () => scope.conversationEvents.register(shadowRelayMarkerDefinition),
      'ui-shadow-mind: relay marker projection',
    )
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
      }),
    }, ShadowReportCard))
    scope.slots.inject('conversation.chat.node', () => scope.slots.register({
      name: 'conversation.chat.node',
      key: 'shadow-mind-relay-marker',
    }, ShadowRelayMarker))
    const injected = (): ShadowMindSettingsTabInjected => ({
      hooks: { settings },
      saveSettings: next => saveSettings(settings, connection.api, next),
      catalog: () => remoteValue<ShadowAdministrationSnapshot>('shadowMind.catalog', remote.catalog()),
      create: input => remoteValue<ShadowDefinition>('shadowMind.create', remote.create(input)),
      update: input => remoteValue<ShadowDefinition>('shadowMind.update', remote.update(input)),
      setEnabled: (id, enabled) => remoteValue<ShadowDefinition>(
        'shadowMind.setEnabled', remote.setEnabled(id, enabled)),
      delete: id => remoteValue<void>('shadowMind.delete', remote.delete(id)),
      status: sessionId => remoteValue<ShadowMindStatus>('shadowMind.status', remote.status(sessionId)),
      pause: sessionId => remoteValue<ShadowMindStatus>('shadowMind.pause', remote.pause(sessionId)),
      resume: sessionId => remoteValue<ShadowMindStatus>('shadowMind.resume', remote.resume(sessionId)),
      toggle: sessionId => remoteValue<ShadowMindStatus>('shadowMind.toggle', remote.toggle(sessionId)),
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
