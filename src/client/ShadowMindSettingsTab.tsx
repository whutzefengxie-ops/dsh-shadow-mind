import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ObservableSnapshot, SessionId, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ShadowAdministrationSnapshot,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindSettings,
  ShadowMindStatus,
  ShadowRunOutcome,
} from '../runtime/types.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ShadowMindLocaleKey } from './locales.ts'
import css from './ShadowMindSettingsTab.module.css'

/** Browser operations injected by the Shadow Mind client plugin. */
export interface ShadowMindSettingsTabInjected {
  hooks: {
    /** Live settings snapshot bound by the renderer as useSettings. */
    settings: ObservableSnapshot<SettingsScopeSnapshot<ShadowMindSettings>>
  }
  /** Persist a complete settings form. */
  saveSettings: (next: ShadowMindSettings) => Promise<void>
  catalog: () => Promise<ShadowAdministrationSnapshot>
  create: (input: ShadowDefinitionInput) => Promise<ShadowDefinition>
  update: (input: ShadowDefinitionInput) => Promise<ShadowDefinition>
  setEnabled: (id: string, enabled: boolean) => Promise<ShadowDefinition>
  delete: (id: string) => Promise<void>
  status: (sessionId: SessionId) => Promise<ShadowMindStatus>
  pause: (sessionId: SessionId) => Promise<ShadowMindStatus>
  resume: (sessionId: SessionId) => Promise<ShadowMindStatus>
  toggle: (sessionId: SessionId) => Promise<ShadowMindStatus>
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

type SettingsDraft = Record<keyof ShadowMindSettings, string>

interface DefinitionDraft {
  id: string
  name: string
  enabled: boolean
  debug: boolean
  activationProbability: string
  activeForModels: string
  runWithModel: string
  reasoningEffort: string
  timeoutSeconds: string
  tools: string
  prompt: string
}

const NUMBER_FIELDS = [
  'heartbeatProbability',
  'maxParallelShadows',
  'defaultShadowTimeoutSeconds',
  'headlessDrainTimeoutSeconds',
  'resultBatchWindowMs',
  'randomSeed',
  'maxPromptChars',
  'maxReportChars',
] as const satisfies readonly (keyof ShadowMindSettings)[]

const OUTCOME_KEYS = {
  report: 'outcomeReport',
  silent: 'outcomeSilent',
  not_relevant: 'outcomeNotRelevant',
  aborted: 'outcomeAborted',
  failed: 'outcomeFailed',
} as const satisfies Record<ShadowRunOutcome, ShadowMindLocaleKey>

/** Render one settings value as editable text. */
function settingsDraft(value: ShadowMindSettings): SettingsDraft {
  return {
    heartbeatProbability: String(value.heartbeatProbability),
    maxParallelShadows: String(value.maxParallelShadows),
    defaultShadowTimeoutSeconds: String(value.defaultShadowTimeoutSeconds),
    headlessDrainTimeoutSeconds: String(value.headlessDrainTimeoutSeconds),
    resultBatchWindowMs: String(value.resultBatchWindowMs),
    defaultShadowModel: value.defaultShadowModel ?? '',
    defaultReasoningEffort: value.defaultReasoningEffort ?? '',
    argumentDisclosure: value.argumentDisclosure,
    randomSeed: value.randomSeed === undefined ? '' : String(value.randomSeed),
    maxPromptChars: String(value.maxPromptChars),
    maxReportChars: String(value.maxReportChars),
  }
}

/** Build an empty create form. */
function emptyDefinition(): DefinitionDraft {
  return {
    id: '',
    name: '',
    enabled: true,
    debug: false,
    activationProbability: '0.3',
    activeForModels: '',
    runWithModel: '',
    reasoningEffort: '',
    timeoutSeconds: '',
    tools: '',
    prompt: '',
  }
}

/** Render one persisted definition into the complete edit form. */
function definitionDraft(value: ShadowDefinition): DefinitionDraft {
  return {
    id: value.id,
    name: value.name,
    enabled: value.enabled,
    debug: value.debug,
    activationProbability: String(value.activationProbability),
    activeForModels: value.activeForModels.join('\n'),
    runWithModel: value.runWithModel ?? '',
    reasoningEffort: value.reasoningEffort ?? '',
    timeoutSeconds: value.timeoutSeconds === undefined ? '' : String(value.timeoutSeconds),
    tools: value.tools.join('\n'),
    prompt: value.prompt,
  }
}

/** Split newline-delimited form fields while rejecting no values locally. */
function lines(text: string): string[] {
  return text.split(/\r?\n/u).map(value => value.trim()).filter(value => value !== '')
}

/** Parse one finite numeric draft. */
function finite(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

/** Validate and convert a complete Shadow definition form. */
function definitionInput(draft: DefinitionDraft): ShadowDefinitionInput | undefined {
  const probability = finite(draft.activationProbability)
  const timeout = finite(draft.timeoutSeconds)
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(draft.id)
    || draft.name.trim() === ''
    || draft.prompt.trim() === ''
    || probability === undefined || probability < 0 || probability > 1
    || (draft.timeoutSeconds.trim() !== '' && (timeout === undefined || timeout <= 0))) return undefined
  return {
    id: draft.id,
    name: draft.name.trim(),
    enabled: draft.enabled,
    debug: draft.debug,
    activationProbability: probability,
    activeForModels: lines(draft.activeForModels),
    runWithModel: draft.runWithModel.trim() || null,
    reasoningEffort: draft.reasoningEffort.trim() || null,
    timeoutSeconds: timeout ?? null,
    tools: lines(draft.tools),
    prompt: draft.prompt.trim(),
  }
}

/** Validate and convert the complete resolved settings form. */
function settingsInput(draft: SettingsDraft): ShadowMindSettings | undefined {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(field => [field, finite(draft[field])])) as
    Record<(typeof NUMBER_FIELDS)[number], number | undefined>
  if (numbers.heartbeatProbability === undefined || numbers.heartbeatProbability < 0 || numbers.heartbeatProbability > 1
    || numbers.maxParallelShadows === undefined || !Number.isInteger(numbers.maxParallelShadows) || numbers.maxParallelShadows < 1
    || numbers.defaultShadowTimeoutSeconds === undefined || numbers.defaultShadowTimeoutSeconds <= 0
    || numbers.headlessDrainTimeoutSeconds === undefined || numbers.headlessDrainTimeoutSeconds <= 0
    || numbers.resultBatchWindowMs === undefined || numbers.resultBatchWindowMs < 0
    || (draft.randomSeed.trim() !== '' && numbers.randomSeed === undefined)
    || numbers.maxPromptChars === undefined || !Number.isInteger(numbers.maxPromptChars) || numbers.maxPromptChars < 1
    || numbers.maxReportChars === undefined || !Number.isInteger(numbers.maxReportChars) || numbers.maxReportChars < 1) return undefined
  return {
    heartbeatProbability: numbers.heartbeatProbability,
    maxParallelShadows: numbers.maxParallelShadows,
    defaultShadowTimeoutSeconds: numbers.defaultShadowTimeoutSeconds,
    headlessDrainTimeoutSeconds: numbers.headlessDrainTimeoutSeconds,
    resultBatchWindowMs: numbers.resultBatchWindowMs,
    ...(draft.defaultShadowModel.trim() === '' ? {} : { defaultShadowModel: draft.defaultShadowModel.trim() }),
    ...(draft.defaultReasoningEffort.trim() === '' ? {} : { defaultReasoningEffort: draft.defaultReasoningEffort.trim() }),
    argumentDisclosure: draft.argumentDisclosure === 'full' ? 'full' : 'redacted',
    ...(numbers.randomSeed === undefined ? {} : { randomSeed: numbers.randomSeed }),
    maxPromptChars: numbers.maxPromptChars,
    maxReportChars: numbers.maxReportChars,
  }
}

/** Standard labelled text or numeric control. */
function Field(props: {
  id: string
  label: string
  hint?: string
  value: string
  disabled?: boolean
  multiline?: boolean
  onChange: (value: string) => void
}): ReactNode {
  const control = props.multiline === true
    ? <textarea id={props.id} value={props.value} disabled={props.disabled}
      onChange={(event) => { props.onChange(event.currentTarget.value) }} />
    : <input id={props.id} type="text" value={props.value} disabled={props.disabled}
      onChange={(event) => { props.onChange(event.currentTarget.value) }} />
  return (
    <label className={css.field} htmlFor={props.id}>
      <span>{props.label}</span>
      {control}
      {props.hint === undefined ? null : <small>{props.hint}</small>}
    </label>
  )
}

/** Shadow Mind administration tab under Settings → Plugins. */
function ShadowMindSettingsTabContent(props: ShadowMindSettingsTabProps): ReactNode {
  const { t } = props
  const settings = props.useSettings(snapshot => snapshot)
  const currentSession = props.useSessions(snapshot => snapshot.current)
  const currentSessionUpdatedAt = props.useSessions((snapshot) => {
    const sessionId = snapshot.current
    return sessionId === undefined ? undefined : snapshot.byId[sessionId]?.updatedAt
  })
  const [catalog, setCatalog] = useState<ShadowAdministrationSnapshot | null>(null)
  const [status, setStatus] = useState<ShadowMindStatus | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [settingsEdit, setSettingsEdit] = useState<SettingsDraft | null>(null)
  const [definitionEdit, setDefinitionEdit] = useState<DefinitionDraft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (settings.status === 'ready' && settings.value !== undefined && settingsEdit === null) {
      setSettingsEdit(settingsDraft(settings.value))
    }
  }, [settings, settingsEdit])
  useEffect(() => {
    let current = true
    if (currentSession === undefined) {
      setStatus(null)
      return () => { current = false }
    }
    void props.status(currentSession).then(
      (value) => { if (current) setStatus(value) },
      () => {
        if (!current) return
        setStatus(null)
        setLoadError(true)
      },
    )
    return () => { current = false }
  }, [currentSession, currentSessionUpdatedAt, props.status])

  const validSettings = settingsEdit === null ? undefined : settingsInput(settingsEdit)
  const validDefinition = definitionEdit === null ? undefined : definitionInput(definitionEdit)
  const settingsDirty = useMemo(() => settings.status === 'ready' && settings.value !== undefined
    && settingsEdit !== null && JSON.stringify(validSettings) !== JSON.stringify(settings.value),
  [settings, settingsEdit, validSettings])

  const run = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      await operation()
    } catch (error: unknown) {
      setMessage(`${t('operationFailed')}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (operation: (sessionId: SessionId) => Promise<ShadowMindStatus>): void => {
    if (currentSession === undefined) return
    void run(async () => { setStatus(await operation(currentSession)) })
  }

  const submitDefinition = (): void => {
    if (validDefinition === undefined) {
      setMessage(t('invalidForm'))
      return
    }
    void run(async () => {
      if (editingId === null) await props.create(validDefinition)
      else await props.update(validDefinition)
      setDefinitionEdit(null)
      setEditingId(null)
      await reload()
    })
  }

  return (
    <div className={css.page} data-shadow-mind-settings>
      <header className={css.hero}>
        <div><h2>{t('title')}</h2><p>{t('intro')}</p></div>
        <button type="button" disabled={busy} onClick={refresh}>{t('refresh')}</button>
      </header>
      {loadError ? <p role="alert" className={css.error}>{t('loadError')}</p> : null}
      {message === '' ? null : <p role="status" className={css.message}>{message}</p>}

      <section className={css.panel} data-shadow-session-status>
        <h3>{t('sessionTitle')}</h3>
        {currentSession === undefined || status === null ? <p>{t('noSession')}</p> : (
          <>
            <div className={css.statusLine}>
              <strong>{t(status.paused ? 'sessionPaused' : 'sessionActive')}</strong>
              <span>{t('running')}: {status.active.length}</span>
              <span>{t('pending')}: {status.pendingSchedules}</span>
              <span>{t('totalRuns')}: {status.totalRuns}</span>
              <span>{t('epoch')}: {status.epoch}</span>
            </div>
            {status.lastRun === undefined ? <p>{t('noCompletedRuns')}</p> : (
              <dl className={css.lastRun} data-shadow-last-run>
                <div><dt>{t('lastRun')}</dt><dd>{status.lastRun.shadowId}</dd></div>
                <div><dt>{t('outcome')}</dt><dd>{t(OUTCOME_KEYS[status.lastRun.outcome])}</dd></div>
                <div><dt>{t('finishedAt')}</dt><dd><time dateTime={status.lastRun.finishedAt}>{status.lastRun.finishedAt}</time></dd></div>
                <div><dt>{t('capturedThroughSeq')}</dt><dd>{status.lastRun.capturedThroughSeq}</dd></div>
                <div><dt>{t('reviewStage')}</dt><dd><code>{status.lastRun.stage}</code></dd></div>
                {status.lastRun.reasonCode === undefined ? null : (
                  <div><dt>{t('reviewReason')}</dt><dd><code>{status.lastRun.reasonCode}</code></dd></div>
                )}
                {status.lastRun.childSessionId === undefined ? null : (
                  <div><dt>{t('childSession')}</dt><dd><code>{status.lastRun.childSessionId}</code></dd></div>
                )}
              </dl>
            )}
            <div className={css.actions}>
              <button type="button" disabled={busy || status.paused} onClick={() => { changeStatus(props.pause) }}>{t('pause')}</button>
              <button type="button" disabled={busy || !status.paused} onClick={() => { changeStatus(props.resume) }}>{t('resume')}</button>
              <button type="button" disabled={busy} onClick={() => { changeStatus(props.toggle) }}>{t('toggle')}</button>
            </div>
          </>
        )}
      </section>

      <section className={css.panel} data-shadow-global-settings>
        <h3>{t('settingsTitle')}</h3>
        <p>{t('settingsDescription')}</p>
        {settingsEdit === null ? <p>{t('loadError')}</p> : (
          <div className={css.grid}>
            {([
              ['heartbeatProbability', 'heartbeatProbabilityHint'],
              ['maxParallelShadows', 'maxParallelShadowsHint'],
              ['defaultShadowTimeoutSeconds', 'defaultShadowTimeoutSecondsHint'],
              ['headlessDrainTimeoutSeconds', 'headlessDrainTimeoutSecondsHint'],
              ['resultBatchWindowMs', 'resultBatchWindowMsHint'],
              ['defaultShadowModel', 'defaultShadowModelHint'],
              ['defaultReasoningEffort', 'defaultReasoningEffortHint'],
              ['randomSeed', 'randomSeedHint'],
              ['maxPromptChars', 'maxPromptCharsHint'],
              ['maxReportChars', 'maxReportCharsHint'],
            ] as const).map(([field, hint]) => (
              <Field key={field} id={`shadow-setting-${field}`} label={t(field)} hint={t(hint)} value={settingsEdit[field]}
                onChange={(value) => { setSettingsEdit({ ...settingsEdit, [field]: value }) }} />
            ))}
            <label className={css.field} htmlFor="shadow-setting-argumentDisclosure">
              <span>{t('argumentDisclosure')}</span>
              <select id="shadow-setting-argumentDisclosure" value={settingsEdit.argumentDisclosure}
                onChange={(event) => { setSettingsEdit({ ...settingsEdit, argumentDisclosure: event.currentTarget.value }) }}>
                <option value="redacted">redacted</option><option value="full">full</option>
              </select>
              <small>{t('argumentDisclosureHint')}</small>
            </label>
            <div className={css.formActions}>
              <button type="button" disabled={!settingsDirty || busy} onClick={() => {
                if (settings.status === 'ready' && settings.value !== undefined) setSettingsEdit(settingsDraft(settings.value))
              }}>{t('discard')}</button>
              <button type="button" disabled={!settingsDirty || validSettings === undefined || busy} onClick={() => {
                if (validSettings === undefined) return
                void run(async () => {
                  await props.saveSettings(validSettings)
                  setSettingsEdit(settingsDraft(validSettings))
                  setMessage(t('saved'))
                })
              }}>{t(busy ? 'saving' : 'saveSettings')}</button>
            </div>
          </div>
        )}
      </section>

      <section className={css.panel} data-shadow-definitions>
        <div className={css.sectionHead}><div><h3>{t('definitionsTitle')}</h3><p>{t('definitionsDescription')}</p></div>
          <button type="button" disabled={busy} onClick={() => { setEditingId(null); setDefinitionEdit(emptyDefinition()) }}>{t('addShadow')}</button></div>
        {catalog === null ? null : <p className={css.path}><strong>{t('definitionRoot')}:</strong> <code>{catalog.definitionRoot}</code></p>}
        {catalog?.definitions.length === 0 ? <p>{t('emptyDefinitions')}</p> : null}
        <ul className={css.definitions}>
          {catalog?.definitions.map(definition => (
            <li key={definition.id} data-shadow-id={definition.id}>
              <div className={css.definitionTitle}><div><strong>{definition.name}</strong><code>{definition.id}</code></div>
                <span data-enabled={definition.enabled}>{t(definition.enabled ? 'enabled' : 'disabled')}</span></div>
              <dl><div><dt>{t('activationProbability')}</dt><dd>{definition.activationProbability}</dd></div>
                <div><dt>{t('runWithModel')}</dt><dd>{definition.runWithModel ?? 'inherit'}</dd></div>
                <div><dt>{t('sourcePath')}</dt><dd><code>{definition.sourcePath}</code></dd></div></dl>
              <div className={css.actions}>
                <button type="button" disabled={busy} onClick={() => { void run(async () => { await props.setEnabled(definition.id, !definition.enabled); await reload() }) }}>
                  {t(definition.enabled ? 'disable' : 'enable')}
                </button>
                <button type="button" disabled={busy} onClick={() => { setEditingId(definition.id); setDefinitionEdit(definitionDraft(definition)) }}>{t('edit')}</button>
                <button type="button" disabled={busy} data-confirm={deleteId === definition.id} onClick={() => {
                  if (deleteId !== definition.id) { setDeleteId(definition.id); return }
                  void run(async () => { await props.delete(definition.id); setDeleteId(null); await reload() })
                }}>{t(deleteId === definition.id ? 'confirmDelete' : 'delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {definitionEdit === null ? null : (
        <section className={css.panel} data-shadow-editor>
          <h3>{t(editingId === null ? 'createTitle' : 'editTitle')}</h3>
          <div className={css.grid}>
            <Field id="shadow-definition-id" label={t('id')} hint={t('idHint')} value={definitionEdit.id} disabled={editingId !== null}
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, id: value }) }} />
            <Field id="shadow-definition-name" label={t('name')} value={definitionEdit.name}
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, name: value }) }} />
            <Field id="shadow-definition-probability" label={t('activationProbability')} hint={t('activationProbabilityHint')} value={definitionEdit.activationProbability}
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, activationProbability: value }) }} />
            <Field id="shadow-definition-models" label={t('activeForModels')} hint={t('activeForModelsHint')} value={definitionEdit.activeForModels} multiline
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, activeForModels: value }) }} />
            <Field id="shadow-definition-run-model" label={t('runWithModel')} hint={t('runWithModelHint')} value={definitionEdit.runWithModel}
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, runWithModel: value }) }} />
            <Field id="shadow-definition-effort" label={t('reasoningEffort')} hint={t('reasoningEffortHint')} value={definitionEdit.reasoningEffort}
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, reasoningEffort: value }) }} />
            <Field id="shadow-definition-timeout" label={t('timeoutSeconds')} hint={t('timeoutSecondsHint')} value={definitionEdit.timeoutSeconds}
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, timeoutSeconds: value }) }} />
            <Field id="shadow-definition-tools" label={t('tools')} hint={t('toolsHint')} value={definitionEdit.tools} multiline
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, tools: value }) }} />
            <Field id="shadow-definition-prompt" label={t('prompt')} hint={t('promptHint')} value={definitionEdit.prompt} multiline
              onChange={(value) => { setDefinitionEdit({ ...definitionEdit, prompt: value }) }} />
            <label className={css.check}><input type="checkbox" checked={definitionEdit.enabled}
              onChange={(event) => { setDefinitionEdit({ ...definitionEdit, enabled: event.currentTarget.checked }) }} />{t('enabled')}</label>
            <label className={css.check}><input type="checkbox" checked={definitionEdit.debug}
              onChange={(event) => { setDefinitionEdit({ ...definitionEdit, debug: event.currentTarget.checked }) }} />{t('debug')}</label>
            <div className={css.formActions}><button type="button" disabled={busy} onClick={() => { setDefinitionEdit(null); setEditingId(null) }}>{t('cancel')}</button>
              <button type="button" disabled={busy || validDefinition === undefined} onClick={submitDefinition}>{t(editingId === null ? 'create' : 'saveDefinition')}</button></div>
          </div>
        </section>
      )}

      <section className={css.panel} data-shadow-diagnostics>
        <h3>{t('diagnosticsTitle')}</h3>
        {catalog?.diagnostics.length === 0 ? <p>{t('noDiagnostics')}</p> : null}
        <ul>{catalog?.diagnostics.map(diagnostic => <li key={diagnostic.path}><code>{diagnostic.path}</code>: {diagnostic.error}</li>)}</ul>
      </section>
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
