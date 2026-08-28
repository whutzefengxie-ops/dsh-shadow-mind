import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {
  ShadowAdministrationSnapshot,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindStatus,
  ShadowRunOutcome,
} from '../runtime/types.ts'
import { DEFAULT_SHADOW_ID } from '../runtime/types.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ShadowMindLocaleKey } from './locales.ts'
import { SHADOW_TEMPLATES } from './templates.ts'
import { ModelRouteSelect } from './ModelRouteSelect.tsx'
import { ProbabilitySlider, Switch } from './controls.tsx'
import { ToastStack, useToasts } from './ToastStack.tsx'
import css from './ShadowMindSettingsTab.module.css'

/** Browser operations injected by the Shadow Mind client plugin. */
export interface ShadowMindSettingsTabInjected {
  /** Persist the complete single default Shadow definition. */
  saveDefault: (input: ShadowDefinitionInput) => Promise<ShadowDefinition>
  catalog: () => Promise<ShadowAdministrationSnapshot>
  status: (sessionId: SessionId) => Promise<ShadowMindStatus>
}

/** Full component props assembled by the Settings slot renderer. */
export type ShadowMindSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.shadowMind'>
  & InjectFace<ShadowMindSettingsTabInjected>

interface ShadowMindSettingsTabBoundaryProps {
  readonly children: ReactNode
  readonly failureTitle: string
  readonly failureHint: string
}

interface ShadowMindSettingsTabBoundaryState {
  readonly error: Error | undefined
}

/** Keep a browser render failure visible inside the Settings page. */
class ShadowMindSettingsTabBoundary extends Component<
  ShadowMindSettingsTabBoundaryProps,
  ShadowMindSettingsTabBoundaryState
> {
  override state: ShadowMindSettingsTabBoundaryState = { error: undefined }

  static getDerivedStateFromError(error: unknown): ShadowMindSettingsTabBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  override componentDidCatch(error: Error): void {
    console.error('ui-shadow-mind: Settings tab render failed', error)
  }

  override render(): ReactNode {
    if (this.state.error === undefined) return this.props.children
    return (
      <section className={css.panel} data-shadow-mind-render-error role="alert">
        <h3>{this.props.failureTitle}</h3>
        <p>{this.props.failureHint}</p>
        <p>{this.state.error.message}</p>
      </section>
    )
  }
}

/** String-backed form state for the single default Shadow definition. */
export interface DefinitionDraft {
  name: string
  enabled: boolean
  debug: boolean
  /** Slider percent from 10 through 100 in steps of 10. */
  activationPercent: number
  activeForModels: string
  runWithModel: string
  reasoningEffort: string
  timeoutSeconds: string
  tools: string
  capture: ShadowDefinition['capture']
  context: ShadowDefinition['context']
  thinkFirst: boolean
  holdout: boolean
  prompt: string
}

/** Round one stored probability into the closest slider step. */
export function toActivationPercent(probability: number): number {
  const percent = Math.round(probability * 100 / 10) * 10
  return Math.min(100, Math.max(10, percent))
}

/** Render one persisted definition into the complete edit form. */
export function definitionDraft(value: ShadowDefinition): DefinitionDraft {
  return {
    name: value.name,
    enabled: value.enabled,
    debug: value.debug,
    activationPercent: toActivationPercent(value.activationProbability),
    activeForModels: value.activeForModels.join('\n'),
    runWithModel: value.runWithModel ?? '',
    reasoningEffort: value.reasoningEffort ?? '',
    timeoutSeconds: value.timeoutSeconds === undefined ? '' : String(value.timeoutSeconds),
    tools: value.tools.join('\n'),
    capture: value.capture,
    context: value.context,
    thinkFirst: value.thinkFirst,
    holdout: value.holdout,
    prompt: value.prompt,
  }
}

/** Split newline-delimited form fields while rejecting no values locally. */
function lines(text: string): string[] {
  return text.split(/\r?\n/u).map(value => value.trim()).filter(value => value !== '')
}

/**
 * Normalize a route draft: trim, and map a trailing-slash half-selection
 * (`provider/`) back to the empty inherit route.
 */
function normalizeRoute(text: string): string {
  const trimmed = text.trim()
  return /^[^/\s]+\/$/u.test(trimmed) ? '' : trimmed.replace(/\/+$/u, '')
}

/** Parse one finite numeric draft. */
function finite(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

/** Validate and convert the default Shadow definition form. */
export function definitionInput(draft: DefinitionDraft): ShadowDefinitionInput | undefined {
  const timeout = finite(draft.timeoutSeconds)
  if (draft.name.trim() === ''
    || draft.prompt.trim() === ''
    || (draft.timeoutSeconds.trim() !== '' && (timeout === undefined || timeout <= 0))) return undefined
  return {
    id: DEFAULT_SHADOW_ID,
    name: draft.name.trim(),
    enabled: draft.enabled,
    debug: draft.debug,
    activationProbability: draft.activationPercent / 100,
    activeForModels: lines(draft.activeForModels),
    runWithModel: normalizeRoute(draft.runWithModel) || null,
    reasoningEffort: draft.reasoningEffort.trim() || null,
    timeoutSeconds: timeout ?? null,
    tools: lines(draft.tools),
    capture: draft.capture,
    context: draft.context,
    thinkFirst: draft.thinkFirst,
    holdout: draft.holdout,
    prompt: draft.prompt.trim(),
  }
}

const OUTCOME_KEYS = {
  report: 'outcomeReport',
  silent: 'outcomeSilent',
  not_relevant: 'outcomeNotRelevant',
  aborted: 'outcomeAborted',
  failed: 'outcomeFailed',
} as const satisfies Record<ShadowRunOutcome, ShadowMindLocaleKey>

/** Turn one remote failure into actionable copy for a toast. */
function friendlyError(t: ShadowMindSettingsTabProps['t'], error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('not writable')) return t('errorNotWritable')
  if (message.includes('holdout')) return t('errorHoldout')
  if (message.includes('already exists')) return t('errorAlreadyExists')
  return `${t('operationFailed')}: ${message}`
}

/** Shadow Mind administration tab under Settings → Plugins. */
function ShadowMindSettingsTabContent(props: ShadowMindSettingsTabProps): ReactNode {
  const { t } = props
  const currentSession = props.useSessions(snapshot => snapshot.current)
  const [catalog, setCatalog] = useState<ShadowAdministrationSnapshot | null>(null)
  const [status, setStatus] = useState<ShadowMindStatus | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [definitionEdit, setDefinitionEdit] = useState<DefinitionDraft | null>(null)
  const { toasts, push, dismiss } = useToasts()

  const defaultTimeoutSeconds = catalog?.defaultShadowTimeoutSeconds
  const currentDefinition = catalog?.definitions.find(definition => definition.id === DEFAULT_SHADOW_ID)
  const legacyDefinitions = useMemo(
    () => catalog?.definitions.filter(definition => definition.id !== DEFAULT_SHADOW_ID) ?? [],
    [catalog],
  )

  const reload = async (): Promise<void> => {
    setLoadError(false)
    try {
      setCatalog(await props.catalog())
    } catch {
      setLoadError(true)
    }
  }

  const reloadStatus = async (sessionId: SessionId): Promise<void> => {
    try {
      setStatus(await props.status(sessionId))
    } catch {
      setStatus(null)
      setLoadError(true)
    }
  }

  const refresh = (): void => {
    void reload()
    if (currentSession !== undefined) void reloadStatus(currentSession)
  }

  useEffect(() => {
    void reload()
  }, [])
  useEffect(() => {
    // Seed the draft from the freshly loaded default definition, once.
    if (definitionEdit !== null) return
    const definition = catalog?.definitions.find(item => item.id === DEFAULT_SHADOW_ID)
    if (definition !== undefined) setDefinitionEdit(definitionDraft(definition))
  }, [catalog, definitionEdit])
  useEffect(() => {
    let live = true
    if (currentSession === undefined) {
      setStatus(null)
      return () => { live = false }
    }
    void props.status(currentSession).then(
      (value) => { if (live) setStatus(value) },
      () => {
        if (!live) return
        setStatus(null)
        setLoadError(true)
      },
    )
    return () => { live = false }
  }, [currentSession, props.status])

  const validDefinition = definitionEdit === null ? undefined : definitionInput(definitionEdit)
  const baselineInput = currentDefinition === undefined ? undefined : definitionInput(definitionDraft(currentDefinition))
  const definitionDirty = useMemo(() => validDefinition !== undefined && baselineInput !== undefined
    && JSON.stringify(validDefinition) !== JSON.stringify(baselineInput),
  [validDefinition, baselineInput])

  const run = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await operation()
    } catch (error: unknown) {
      push('error', friendlyError(t, error))
    } finally {
      setBusy(false)
    }
  }

  const save = (): void => {
    if (validDefinition === undefined) return
    void run(async () => {
      const saved = await props.saveDefault(validDefinition)
      setDefinitionEdit(definitionDraft(saved))
      await reload()
      push('success', t('saved'))
    })
  }

  const discard = (): void => {
    if (currentDefinition === undefined) return
    setDefinitionEdit(definitionDraft(currentDefinition))
  }

  return (
    <div className={css.page} data-shadow-mind-settings>
      <header className={css.hero}>
        <div><h2>{t('title')}</h2><p>{t('intro')}</p></div>
        <button type="button" disabled={busy} onClick={refresh}>{t('refresh')}</button>
      </header>
      {loadError ? <p role="alert" className={css.error}>{t('loadError')}</p> : null}

      <section className={css.panel} data-shadow-card>
        <div className={css.cardHead}>
          <div>
            <h3>{t('shadowCardTitle')}</h3>
            <p>{t('shadowCardDescription')}</p>
          </div>
          {definitionEdit !== null ? (
            <Switch
              id="shadow-enabled"
              label={t(definitionEdit.enabled ? 'shadowOn' : 'shadowOff')}
              checked={definitionEdit.enabled}
              disabled={busy}
              onChange={(enabled) => { setDefinitionEdit({ ...definitionEdit, enabled }) }}
            />
          ) : null}
        </div>

        {status === null || status.lastRun === undefined ? null : (
          <p className={css.lastRunLine}>
            {t('lastRunSummary', {
              outcome: t(OUTCOME_KEYS[status.lastRun.outcome]),
              time: status.lastRun.finishedAt,
            })}
          </p>
        )}

        {definitionEdit === null ? <p>{t('noDefaultDefinition')}</p> : (
          <>
            <div className={css.grid}>
              <ProbabilitySlider
                id="shadow-probability"
                label={t('triggerProbability')}
                value={definitionEdit.activationPercent}
                disabled={busy}
                onChange={(percent) => { setDefinitionEdit({ ...definitionEdit, activationPercent: percent }) }}
              />
              <small className={css.probabilityHint}>{t('triggerProbabilityHint')}</small>
              <label className={css.field} htmlFor="shadow-preset">
                <span>{t('presetLabel')}</span>
                <select
                  id="shadow-preset"
                  value=""
                  disabled={busy}
                  onChange={(event) => {
                    const preset = SHADOW_TEMPLATES.find(template => template.id === event.currentTarget.value)
                    if (preset === undefined) return
                    setDefinitionEdit({
                      ...definitionEdit,
                      prompt: preset.prompt,
                      capture: preset.capture,
                    })
                  }}
                >
                  <option value="" disabled>{t('presetPlaceholder')}</option>
                  {SHADOW_TEMPLATES.map(template => (
                    <option key={template.id} value={template.id}>{t(template.nameKey)}</option>
                  ))}
                </select>
                <small>{t('presetHint')}</small>
              </label>
              <label className={css.field} htmlFor="shadow-name">
                <span>{t('shadowName')}</span>
                <input id="shadow-name" type="text" value={definitionEdit.name} disabled={busy}
                  onChange={(event) => { setDefinitionEdit({ ...definitionEdit, name: event.currentTarget.value }) }} />
                <small>{t('shadowNameHint')}</small>
              </label>
              <label className={css.field} htmlFor="shadow-prompt">
                <span>{t('shadowPrompt')}</span>
                <textarea id="shadow-prompt" value={definitionEdit.prompt} disabled={busy}
                  onChange={(event) => { setDefinitionEdit({ ...definitionEdit, prompt: event.currentTarget.value }) }} />
                <small>{t('shadowPromptHint')}</small>
              </label>
            </div>

            <details className={css.disclosure} data-shadow-advanced>
              <summary>{t('advancedSettings')}</summary>
              <div className={css.grid}>
                <fieldset className={`${css.fieldset} ${css.fullSpan}`}>
                  <legend>{t('runModel')}</legend>
                  <div className={`${css.grid} ${css.stack}`}>
                    <ModelRouteSelect
                      catalog={catalog?.modelCatalog ?? null}
                      disabled={busy}
                      labels={{
                        provider: t('providerLabel'),
                        model: t('modelLabel'),
                        effort: t('effortLabel'),
                      }}
                      value={{
                        route: definitionEdit.runWithModel,
                        effort: definitionEdit.reasoningEffort,
                      }}
                      onChange={(next) => {
                        setDefinitionEdit({
                          ...definitionEdit,
                          runWithModel: next.route,
                          reasoningEffort: next.effort,
                        })
                      }}
                    />
                  </div>
                  <small>{t('runModelHint')}</small>
                </fieldset>
                <label className={css.field} htmlFor="shadow-timeout">
                  <span>{t('timeoutSeconds')}</span>
                  <input id="shadow-timeout" type="text" value={definitionEdit.timeoutSeconds} disabled={busy}
                    placeholder={defaultTimeoutSeconds === undefined ? undefined : String(defaultTimeoutSeconds)}
                    onChange={(event) => { setDefinitionEdit({ ...definitionEdit, timeoutSeconds: event.currentTarget.value }) }} />
                  <small>
                    {defaultTimeoutSeconds === undefined
                      ? t('timeoutSecondsHint')
                      : t('timeoutSecondsInherit', {
                        seconds: defaultTimeoutSeconds,
                        minutes: Math.round(defaultTimeoutSeconds / 60),
                      })}
                  </small>
                </label>
                <label className={css.field} htmlFor="shadow-tools">
                  <span>{t('tools')}</span>
                  <textarea id="shadow-tools" value={definitionEdit.tools} disabled={busy}
                    onChange={(event) => { setDefinitionEdit({ ...definitionEdit, tools: event.currentTarget.value }) }} />
                  <small>{t('toolsHint')}</small>
                </label>
                <label className={css.field} htmlFor="shadow-capture">
                  <span>{t('capture')}</span>
                  <select id="shadow-capture" value={definitionEdit.capture} disabled={busy}
                    onChange={(event) => { setDefinitionEdit({ ...definitionEdit, capture: event.currentTarget.value as ShadowDefinition['capture'] }) }}>
                    <option value="full">full</option><option value="since-compaction">since-compaction</option>
                  </select>
                  <small>{t('captureHint')}</small>
                </label>
                <label className={css.field} htmlFor="shadow-context">
                  <span>{t('context')}</span>
                  <select id="shadow-context" value={definitionEdit.context} disabled={busy}
                    onChange={(event) => { setDefinitionEdit({ ...definitionEdit, context: event.currentTarget.value as ShadowDefinition['context'] }) }}>
                    <option value="standard">standard</option><option value="minimal">minimal</option>
                  </select>
                  <small>{t('contextHint')}</small>
                </label>
                <Switch
                  id="shadow-think-first"
                  label={t('thinkFirst')}
                  checked={definitionEdit.thinkFirst}
                  disabled={busy}
                  onChange={(thinkFirst) => { setDefinitionEdit({ ...definitionEdit, thinkFirst }) }}
                />
                <Switch
                  id="shadow-debug"
                  label={t('debug')}
                  checked={definitionEdit.debug}
                  disabled={busy}
                  onChange={(debug) => { setDefinitionEdit({ ...definitionEdit, debug }) }}
                />
              </div>
            </details>

            {legacyDefinitions.length === 0 ? null : (
              <p className={css.legacyNote} data-shadow-legacy>
                {t('legacyDefinitions', {
                  count: legacyDefinitions.length,
                  ids: legacyDefinitions.map(definition => definition.id).join(', '),
                })}
              </p>
            )}
            {catalog === null || catalog.diagnostics.length === 0 ? null : (
              <p className={css.error} data-shadow-diagnostics>
                {t('diagnosticsNotice', {
                  count: catalog.diagnostics.length,
                  paths: catalog.diagnostics.slice(0, 3).map(item => item.path).join(', '),
                })}
              </p>
            )}

            <div className={css.formActions}>
              <button type="button" disabled={!definitionDirty || busy} onClick={discard}>{t('discard')}</button>
              <button type="button" disabled={!definitionDirty || validDefinition === undefined || busy}
                onClick={save}>{t(busy ? 'saving' : 'saveShadow')}</button>
            </div>
          </>
        )}
      </section>

      <ToastStack toasts={toasts} dismissLabel={t('toastDismiss')} onDismiss={dismiss} />
    </div>
  )
}

/** Render the Settings page while containing component failures to its panel. */
export function ShadowMindSettingsTab(props: ShadowMindSettingsTabProps): ReactNode {
  return (
    <ShadowMindSettingsTabBoundary
      failureTitle={props.t('renderErrorTitle')}
      failureHint={props.t('renderErrorHint')}
    >
      <ShadowMindSettingsTabContent {...props} />
    </ShadowMindSettingsTabBoundary>
  )
}
