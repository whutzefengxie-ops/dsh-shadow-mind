import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ObservableSnapshot, SessionId, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
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
import { SHADOW_TEMPLATES, type ShadowTemplate } from './templates.ts'
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

/** String-backed form state for every resolved Shadow Mind setting. */
export type SettingsDraft = Record<keyof ShadowMindSettings, string>

/** String-backed form state for one editable Shadow definition. */
export interface DefinitionDraft {
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
  capture: ShadowDefinition['capture']
  context: ShadowDefinition['context']
  thinkFirst: boolean
  preFilters: string
  boostFilters: string
  boostFactor: string
  holdout: boolean
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
  'longOutputBoostChars',
  'lastReportCoversCount',
  'repeatedFailureBoostThreshold',
  'valueLoopWindowTurns',
  'reviewWindowSize',
  'spinningRepeatCount',
  'oscillationPeriods',
  'noDriftRepeatCount',
  'diminishingWindowSize',
  'diminishingNoveltyThreshold',
  'stagnationCooldownSeconds',
  'sessionShadowSoftBudgetChars',
  'sessionShadowHardBudgetChars',
  'staleReportDecay',
  'conflictSynthesisTimeoutSeconds',
] as const satisfies readonly (keyof ShadowMindSettings)[]

const BOOLEAN_FIELDS = [
  'preferIndependentVendor',
  'valueLoopEnabled',
  'stagnationEscalationEnabled',
  'conflictSynthesisEnabled',
] as const satisfies readonly (keyof ShadowMindSettings)[]

/** Ordered text/numeric global settings rendered as simple fields. */
const SETTING_TEXT_FIELDS = [
  ['heartbeatProbability', 'heartbeatProbabilityHint'],
  ['maxParallelShadows', 'maxParallelShadowsHint'],
  ['defaultShadowTimeoutSeconds', 'defaultShadowTimeoutSecondsHint'],
  ['defaultShadowModel', 'defaultShadowModelHint'],
  ['defaultReasoningEffort', 'defaultReasoningEffortHint'],
  ['headlessDrainTimeoutSeconds', 'headlessDrainTimeoutSecondsHint'],
  ['resultBatchWindowMs', 'resultBatchWindowMsHint'],
  ['randomSeed', 'randomSeedHint'],
  ['maxPromptChars', 'maxPromptCharsHint'],
  ['maxReportChars', 'maxReportCharsHint'],
  ['longOutputBoostChars', 'longOutputBoostCharsHint'],
  ['lastReportCoversCount', 'lastReportCoversCountHint'],
  ['repeatedFailureBoostThreshold', 'repeatedFailureBoostThresholdHint'],
  ['valueLoopWindowTurns', 'valueLoopWindowTurnsHint'],
  ['reviewWindowSize', 'reviewWindowSizeHint'],
  ['spinningRepeatCount', 'spinningRepeatCountHint'],
  ['oscillationPeriods', 'oscillationPeriodsHint'],
  ['noDriftRepeatCount', 'noDriftRepeatCountHint'],
  ['diminishingWindowSize', 'diminishingWindowSizeHint'],
  ['diminishingNoveltyThreshold', 'diminishingNoveltyThresholdHint'],
  ['stagnationCooldownSeconds', 'stagnationCooldownSecondsHint'],
  ['sessionShadowSoftBudgetChars', 'sessionShadowSoftBudgetCharsHint'],
  ['sessionShadowHardBudgetChars', 'sessionShadowHardBudgetCharsHint'],
  ['frugalShadowModel', 'frugalShadowModelHint'],
  ['staleReportDecay', 'staleReportDecayHint'],
  ['conflictSynthesisTimeoutSeconds', 'conflictSynthesisTimeoutSecondsHint'],
] as const satisfies readonly (readonly [keyof ShadowMindSettings, ShadowMindLocaleKey])[]

/** Global settings shown by default; every other field lives in the advanced disclosure. */
const BASIC_SETTING_FIELDS = new Set<keyof ShadowMindSettings>([
  'heartbeatProbability',
  'maxParallelShadows',
  'defaultShadowTimeoutSeconds',
  'defaultShadowModel',
  'defaultReasoningEffort',
])

const OUTCOME_KEYS = {
  report: 'outcomeReport',
  silent: 'outcomeSilent',
  not_relevant: 'outcomeNotRelevant',
  aborted: 'outcomeAborted',
  failed: 'outcomeFailed',
} as const satisfies Record<ShadowRunOutcome, ShadowMindLocaleKey>

/** Render one settings value as editable text. */
export function settingsDraft(value: ShadowMindSettings): SettingsDraft {
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
    preferIndependentVendor: String(value.preferIndependentVendor),
    longOutputBoostChars: String(value.longOutputBoostChars),
    lastReportCoversCount: String(value.lastReportCoversCount),
    repeatedFailureBoostThreshold: String(value.repeatedFailureBoostThreshold),
    valueLoopEnabled: String(value.valueLoopEnabled),
    valueLoopWindowTurns: String(value.valueLoopWindowTurns),
    reviewWindowSize: String(value.reviewWindowSize),
    spinningRepeatCount: String(value.spinningRepeatCount),
    oscillationPeriods: String(value.oscillationPeriods),
    noDriftRepeatCount: String(value.noDriftRepeatCount),
    diminishingWindowSize: String(value.diminishingWindowSize),
    diminishingNoveltyThreshold: String(value.diminishingNoveltyThreshold),
    stagnationCooldownSeconds: String(value.stagnationCooldownSeconds),
    stagnationEscalationEnabled: String(value.stagnationEscalationEnabled),
    reasoningEffortLadder: value.reasoningEffortLadder.join('\n'),
    sessionShadowSoftBudgetChars: value.sessionShadowSoftBudgetChars === undefined
      ? '' : String(value.sessionShadowSoftBudgetChars),
    sessionShadowHardBudgetChars: value.sessionShadowHardBudgetChars === undefined
      ? '' : String(value.sessionShadowHardBudgetChars),
    frugalShadowModel: value.frugalShadowModel ?? '',
    staleReportDecay: String(value.staleReportDecay),
    conflictSynthesisEnabled: String(value.conflictSynthesisEnabled),
    conflictSynthesisTimeoutSeconds: String(value.conflictSynthesisTimeoutSeconds),
  }
}

/** Build an empty create form. */
export function emptyDefinition(): DefinitionDraft {
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
    capture: 'full',
    context: 'standard',
    thinkFirst: false,
    preFilters: '',
    boostFilters: '',
    boostFactor: '1',
    // Not surfaced in the editor: enabling holdout requires an operator-managed
    // holdout-keys.json sidecar that the Web form cannot administer. New
    // definitions always start with holdout off; the draft field only
    // round-trips a loaded value so saving never clears it.
    holdout: false,
    prompt: '',
  }
}

/** Prefill the create form from one reference template. */
export function templateDraft(template: ShadowTemplate, name: string): DefinitionDraft {
  return {
    ...emptyDefinition(),
    id: template.id,
    name,
    activationProbability: String(template.activationProbability),
    capture: template.capture,
    prompt: template.prompt,
  }
}

/** Render one persisted definition into the complete edit form. */
export function definitionDraft(value: ShadowDefinition): DefinitionDraft {
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
    capture: value.capture,
    context: value.context,
    thinkFirst: value.thinkFirst,
    preFilters: value.preFilters.join('\n'),
    boostFilters: value.boostFilters.join('\n'),
    boostFactor: String(value.boostFactor),
    holdout: value.holdout,
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

/** Retain an integer only when it meets the field's lower bound. */
function integerAtLeast(value: number | undefined, minimum: number): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= minimum ? value : undefined
}

/** Validate and convert a complete Shadow definition form. */
export function definitionInput(draft: DefinitionDraft): ShadowDefinitionInput | undefined {
  const probability = finite(draft.activationProbability)
  const timeout = finite(draft.timeoutSeconds)
  const boostFactor = finite(draft.boostFactor)
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(draft.id)
    || draft.name.trim() === ''
    || draft.prompt.trim() === ''
    || probability === undefined || probability < 0 || probability > 1
    || boostFactor === undefined || boostFactor < 1
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
    capture: draft.capture,
    context: draft.context,
    thinkFirst: draft.thinkFirst,
    preFilters: lines(draft.preFilters),
    boostFilters: lines(draft.boostFilters),
    boostFactor,
    holdout: draft.holdout,
    prompt: draft.prompt.trim(),
  }
}

/** Validate and convert the complete resolved settings form. */
export function settingsInput(draft: SettingsDraft): ShadowMindSettings | undefined {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(field => [field, finite(draft[field])])) as
    Record<(typeof NUMBER_FIELDS)[number], number | undefined>
  const heartbeatProbability = numbers.heartbeatProbability
  const maxParallelShadows = integerAtLeast(numbers.maxParallelShadows, 1)
  const maxPromptChars = integerAtLeast(numbers.maxPromptChars, 1)
  const maxReportChars = integerAtLeast(numbers.maxReportChars, 1)
  const longOutputBoostChars = integerAtLeast(numbers.longOutputBoostChars, 1)
  const valueLoopWindowTurns = integerAtLeast(numbers.valueLoopWindowTurns, 1)
  const reviewWindowSize = integerAtLeast(numbers.reviewWindowSize, 1)
  const diminishingWindowSize = integerAtLeast(numbers.diminishingWindowSize, 1)
  const lastReportCoversCount = integerAtLeast(numbers.lastReportCoversCount, 2)
  const repeatedFailureBoostThreshold = integerAtLeast(numbers.repeatedFailureBoostThreshold, 2)
  const spinningRepeatCount = integerAtLeast(numbers.spinningRepeatCount, 2)
  const oscillationPeriods = integerAtLeast(numbers.oscillationPeriods, 2)
  const noDriftRepeatCount = integerAtLeast(numbers.noDriftRepeatCount, 2)
  const defaultShadowTimeoutSeconds = numbers.defaultShadowTimeoutSeconds
  const headlessDrainTimeoutSeconds = numbers.headlessDrainTimeoutSeconds
  const resultBatchWindowMs = numbers.resultBatchWindowMs
  const diminishingNoveltyThreshold = numbers.diminishingNoveltyThreshold
  const stagnationCooldownSeconds = numbers.stagnationCooldownSeconds
  const staleReportDecay = numbers.staleReportDecay
  const conflictSynthesisTimeoutSeconds = numbers.conflictSynthesisTimeoutSeconds
  const effortLadder = lines(draft.reasoningEffortLadder)
  const soft = numbers.sessionShadowSoftBudgetChars
  const hard = numbers.sessionShadowHardBudgetChars
  const frugalRoute = draft.frugalShadowModel.trim()
  const largestWindow = Math.max(
    spinningRepeatCount ?? Number.POSITIVE_INFINITY,
    (oscillationPeriods ?? Number.POSITIVE_INFINITY) * 2,
    noDriftRepeatCount ?? Number.POSITIVE_INFINITY,
    diminishingWindowSize ?? Number.POSITIVE_INFINITY,
  )
  if (heartbeatProbability === undefined || heartbeatProbability < 0 || heartbeatProbability > 1
    || maxParallelShadows === undefined || maxPromptChars === undefined || maxReportChars === undefined
    || longOutputBoostChars === undefined || valueLoopWindowTurns === undefined || reviewWindowSize === undefined
    || diminishingWindowSize === undefined || lastReportCoversCount === undefined
    || repeatedFailureBoostThreshold === undefined || spinningRepeatCount === undefined
    || oscillationPeriods === undefined || noDriftRepeatCount === undefined
    || defaultShadowTimeoutSeconds === undefined || defaultShadowTimeoutSeconds <= 0
    || headlessDrainTimeoutSeconds === undefined || headlessDrainTimeoutSeconds <= 0
    || resultBatchWindowMs === undefined || resultBatchWindowMs < 0
    || (draft.randomSeed.trim() !== '' && numbers.randomSeed === undefined)
    || diminishingNoveltyThreshold === undefined || diminishingNoveltyThreshold < 0
    || diminishingNoveltyThreshold > 1
    || stagnationCooldownSeconds === undefined || stagnationCooldownSeconds < 0
    || staleReportDecay === undefined || staleReportDecay < 0 || staleReportDecay > 1
    || conflictSynthesisTimeoutSeconds === undefined || conflictSynthesisTimeoutSeconds <= 0
    || (soft !== undefined && (!Number.isInteger(soft) || soft < 1))
    || (hard !== undefined && (!Number.isInteger(hard) || hard < 1))
    || (soft !== undefined && (hard === undefined || frugalRoute === '' || soft >= hard))
    || (frugalRoute !== '' && soft === undefined)
    || effortLadder.length === 0 || new Set(effortLadder).size !== effortLadder.length
    || reviewWindowSize < largestWindow) return undefined
  return {
    heartbeatProbability,
    maxParallelShadows,
    defaultShadowTimeoutSeconds,
    headlessDrainTimeoutSeconds,
    resultBatchWindowMs,
    ...(draft.defaultShadowModel.trim() === '' ? {} : { defaultShadowModel: draft.defaultShadowModel.trim() }),
    ...(draft.defaultReasoningEffort.trim() === '' ? {} : { defaultReasoningEffort: draft.defaultReasoningEffort.trim() }),
    argumentDisclosure: draft.argumentDisclosure === 'full' ? 'full' : 'redacted',
    ...(numbers.randomSeed === undefined ? {} : { randomSeed: numbers.randomSeed }),
    maxPromptChars,
    maxReportChars,
    preferIndependentVendor: draft.preferIndependentVendor === 'true',
    longOutputBoostChars,
    lastReportCoversCount,
    repeatedFailureBoostThreshold,
    valueLoopEnabled: draft.valueLoopEnabled === 'true',
    valueLoopWindowTurns,
    reviewWindowSize,
    spinningRepeatCount,
    oscillationPeriods,
    noDriftRepeatCount,
    diminishingWindowSize,
    diminishingNoveltyThreshold,
    stagnationCooldownSeconds,
    stagnationEscalationEnabled: draft.stagnationEscalationEnabled === 'true',
    reasoningEffortLadder: effortLadder,
    ...(soft === undefined ? {} : { sessionShadowSoftBudgetChars: soft }),
    ...(hard === undefined ? {} : { sessionShadowHardBudgetChars: hard }),
    ...(frugalRoute === '' ? {} : { frugalShadowModel: frugalRoute }),
    staleReportDecay,
    conflictSynthesisEnabled: draft.conflictSynthesisEnabled === 'true',
    conflictSynthesisTimeoutSeconds,
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
  const resolvedSettings = settings.status === 'ready' ? settings.value : undefined
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

  const changeStatus = (
    sessionId: SessionId,
    operation: (sessionId: SessionId) => Promise<ShadowMindStatus>,
  ): void => {
    void run(async () => { setStatus(await operation(sessionId)) })
  }

  const submitDefinition = (input: ShadowDefinitionInput): void => {
    void run(async () => {
      if (editingId === null) await props.create(input)
      else await props.update(input)
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
              <span>{t('prefilterSkips')}: {status.prefilterSkips}</span>
              <span>{t('budgetTier')}: {status.budgetTier}</span>
              <span>{t('spentChars')}: {status.spentChars}</span>
              <span>{t('synthesisRuns')}: {status.synthesisRuns}</span>
              <span>{t('synthesisFailures')}: {status.synthesisFailures}</span>
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
                <div><dt>{t('deliberationChars')}</dt><dd>{status.lastRun.deliberationChars}</dd></div>
                <div><dt>{t('independence')}</dt><dd>{status.lastRun.independence}</dd></div>
                {status.lastRun.route === undefined ? null : (
                  <div><dt>{t('route')}</dt><dd><code>{status.lastRun.route}</code></dd></div>
                )}
                {status.lastRun.childSessionId === undefined ? null : (
                  <div><dt>{t('childSession')}</dt><dd><code>{status.lastRun.childSessionId}</code></dd></div>
                )}
              </dl>
            )}
            <dl className={css.lastRun} data-shadow-diagnostics-status>
              <div><dt>{t('effectiveProbabilities')}</dt><dd>{status.effectiveProbabilities
                .map(value => `${value.shadowId}=${value.probability}`).join(', ') || 'none'}</dd></div>
              <div><dt>{t('valueLoop')}</dt><dd>{status.valueLoop
                .map(value => `${value.shadowId}:${value.adopted}/${value.rejected}/${value.ignored}`).join(', ') || 'none'}</dd></div>
              <div><dt>{t('cooldowns')}</dt><dd>{status.cooldowns
                .map(value => `${value.shadowId}@${value.until}`).join(', ') || 'none'}</dd></div>
              <div><dt>{t('pendingEscalations')}</dt><dd>{status.pendingEscalations.join(', ') || 'none'}</dd></div>
              <div><dt>{t('recentReviews')}</dt><dd>{status.recentReviews
                .map(value => `${value.shadowId}:${value.verdict}`).join(', ') || 'none'}</dd></div>
              {status.lastSynthesisFailure === undefined ? null : (
                <div><dt>{t('lastSynthesisFailure')}</dt><dd>{status.lastSynthesisFailure}</dd></div>
              )}
            </dl>
            <div className={css.actions}>
              <button type="button" disabled={busy || status.paused} onClick={() => { changeStatus(currentSession, props.pause) }}>{t('pause')}</button>
              <button type="button" disabled={busy || !status.paused} onClick={() => { changeStatus(currentSession, props.resume) }}>{t('resume')}</button>
              <button type="button" disabled={busy} onClick={() => { changeStatus(currentSession, props.toggle) }}>{t('toggle')}</button>
            </div>
          </>
        )}
      </section>

      <section className={css.panel} data-shadow-global-settings>
        <h3>{t('settingsTitle')}</h3>
        <p>{t('settingsDescription')}</p>
        {settingsEdit === null ? <p>{t('loadError')}</p> : (
          <>
            <div className={css.grid}>
              {SETTING_TEXT_FIELDS.filter(([field]) => BASIC_SETTING_FIELDS.has(field)).map(([field, hint]) => (
                <Field key={field} id={`shadow-setting-${field}`} label={t(field)} hint={t(hint)} value={settingsEdit[field]}
                  onChange={(value) => { setSettingsEdit({ ...settingsEdit, [field]: value }) }} />
              ))}
            </div>
            <details className={css.disclosure} data-shadow-settings-advanced>
              <summary>
                {t('advancedSettings')}
                <small className={css.disclosureHint}>{t('advancedSettingsHint')}</small>
              </summary>
              <div className={css.grid}>
                {SETTING_TEXT_FIELDS.filter(([field]) => !BASIC_SETTING_FIELDS.has(field)).map(([field, hint]) => (
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
                <Field id="shadow-setting-reasoningEffortLadder" label={t('reasoningEffortLadder')}
                  hint={t('reasoningEffortLadderHint')} value={settingsEdit.reasoningEffortLadder} multiline
                  onChange={(value) => { setSettingsEdit({ ...settingsEdit, reasoningEffortLadder: value }) }} />
                {BOOLEAN_FIELDS.map(field => (
                  <label className={css.field} htmlFor={`shadow-setting-${field}`} key={field}>
                    <span>{t(field)}</span>
                    <select id={`shadow-setting-${field}`} value={settingsEdit[field]}
                      onChange={(event) => { setSettingsEdit({ ...settingsEdit, [field]: event.currentTarget.value }) }}>
                      <option value="false">false</option><option value="true">true</option>
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <div className={css.formActions}>
              <button type="button" disabled={!settingsDirty || busy}
                onClick={resolvedSettings === undefined
                  ? undefined
                  : () => { setSettingsEdit(settingsDraft(resolvedSettings)) }
                }>{t('discard')}</button>
              <button type="button" disabled={!settingsDirty || validSettings === undefined || busy}
                onClick={validSettings === undefined ? undefined : () => {
                  void run(async () => {
                    await props.saveSettings(validSettings)
                    setSettingsEdit(settingsDraft(validSettings))
                    setMessage(t('saved'))
                  })
                }}>{t(busy ? 'saving' : 'saveSettings')}</button>
            </div>
          </>
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
                <div><dt>{t('capture')}</dt><dd>{definition.capture}</dd></div>
                <div><dt>{t('context')}</dt><dd>{definition.context}</dd></div>
                <div><dt>{t('thinkFirst')}</dt><dd>{String(definition.thinkFirst)}</dd></div>
                <div><dt>{t('holdout')}</dt><dd>{String(definition.holdout)}</dd></div>
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

      <section className={css.panel} data-shadow-templates>
        <div className={css.sectionHead}><div><h3>{t('templatesTitle')}</h3><p>{t('templatesDescription')}</p></div></div>
        <ul className={css.definitions}>
          {SHADOW_TEMPLATES.map(template => {
            const exists = catalog?.definitions.some(definition => definition.id === template.id) === true
            return (
              <li key={template.id} data-shadow-template={template.id}>
                <div className={css.definitionTitle}>
                  <div><strong>{t(template.nameKey)}</strong><code>{template.id}</code>
                    <span className={css.templateDescription}>{t(template.descriptionKey)}</span></div>
                  <span data-enabled="false">{t('templateStatus')}</span>
                </div>
                <details className={css.templatePromptDisclosure}>
                  <summary>{t('templatePromptPreview')}</summary>
                  <pre className={css.templatePrompt}>{template.prompt}</pre>
                </details>
                <div className={css.actions}>
                  <button type="button" disabled={busy || exists} onClick={() => {
                    setEditingId(null)
                    setDefinitionEdit(templateDraft(template, t(template.nameKey)))
                  }}>{t(exists ? 'templateExists' : 'useTemplate')}</button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {definitionEdit === null ? null : (
        <section className={css.panel} data-shadow-editor>
          <h3>{t(editingId === null ? 'createTitle' : 'editTitle')}</h3>
          <div className={css.editorStack}>
            <fieldset className={css.fieldset}>
              <legend>{t('definitionBasicFields')}</legend>
              <div className={css.grid}>
                <Field id="shadow-definition-id" label={t('id')} hint={t('idHint')} value={definitionEdit.id} disabled={editingId !== null}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, id: value }) }} />
                <Field id="shadow-definition-name" label={t('name')} value={definitionEdit.name}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, name: value }) }} />
                <Field id="shadow-definition-probability" label={t('activationProbability')} hint={t('activationProbabilityHint')} value={definitionEdit.activationProbability}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, activationProbability: value }) }} />
              </div>
              <Field id="shadow-definition-prompt" label={t('prompt')} hint={t('promptHint')} value={definitionEdit.prompt} multiline
                onChange={(value) => { setDefinitionEdit({ ...definitionEdit, prompt: value }) }} />
              <label className={css.check}><input type="checkbox" checked={definitionEdit.enabled}
                onChange={(event) => { setDefinitionEdit({ ...definitionEdit, enabled: event.currentTarget.checked }) }} />{t('enabled')}</label>
            </fieldset>
            <fieldset className={css.fieldset}>
              <legend>{t('definitionCommonFields')}</legend>
              <div className={css.grid}>
                <Field id="shadow-definition-run-model" label={t('runWithModel')} hint={t('runWithModelHint')} value={definitionEdit.runWithModel}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, runWithModel: value }) }} />
                <Field id="shadow-definition-effort" label={t('reasoningEffort')} hint={t('reasoningEffortHint')} value={definitionEdit.reasoningEffort}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, reasoningEffort: value }) }} />
                <Field id="shadow-definition-timeout" label={t('timeoutSeconds')} hint={t('timeoutSecondsHint')} value={definitionEdit.timeoutSeconds}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, timeoutSeconds: value }) }} />
                <Field id="shadow-definition-tools" label={t('tools')} hint={t('toolsHint')} value={definitionEdit.tools} multiline
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, tools: value }) }} />
              </div>
              <label className={css.check}><input type="checkbox" checked={definitionEdit.thinkFirst}
                onChange={(event) => { setDefinitionEdit({ ...definitionEdit, thinkFirst: event.currentTarget.checked }) }} />{t('thinkFirst')}</label>
            </fieldset>
            <details className={css.disclosure} data-shadow-definition-advanced>
              <summary>{t('definitionAdvancedFields')}</summary>
              <div className={css.grid}>
                <label className={css.check}><input type="checkbox" checked={definitionEdit.debug}
                  onChange={(event) => { setDefinitionEdit({ ...definitionEdit, debug: event.currentTarget.checked }) }} />{t('debug')}</label>
                <Field id="shadow-definition-models" label={t('activeForModels')} hint={t('activeForModelsHint')} value={definitionEdit.activeForModels} multiline
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, activeForModels: value }) }} />
                <label className={css.field} htmlFor="shadow-definition-capture">
                  <span>{t('capture')}</span>
                  <select id="shadow-definition-capture" value={definitionEdit.capture}
                    onChange={(event) => { setDefinitionEdit({ ...definitionEdit, capture: event.currentTarget.value as ShadowDefinition['capture'] }) }}>
                    <option value="full">full</option><option value="since-compaction">since-compaction</option>
                  </select>
                  <small>{t('captureHint')}</small>
                </label>
                <label className={css.field} htmlFor="shadow-definition-context">
                  <span>{t('context')}</span>
                  <select id="shadow-definition-context" value={definitionEdit.context}
                    onChange={(event) => { setDefinitionEdit({ ...definitionEdit, context: event.currentTarget.value as ShadowDefinition['context'] }) }}>
                    <option value="standard">standard</option><option value="minimal">minimal</option>
                  </select>
                  <small>{t('contextHint')}</small>
                </label>
                <Field id="shadow-definition-prefilters" label={t('preFilters')} hint={t('preFiltersHint')}
                  value={definitionEdit.preFilters} multiline
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, preFilters: value }) }} />
                <Field id="shadow-definition-boostfilters" label={t('boostFilters')} hint={t('boostFiltersHint')}
                  value={definitionEdit.boostFilters} multiline
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, boostFilters: value }) }} />
                <Field id="shadow-definition-boostfactor" label={t('boostFactor')} hint={t('boostFactorHint')}
                  value={definitionEdit.boostFactor}
                  onChange={(value) => { setDefinitionEdit({ ...definitionEdit, boostFactor: value }) }} />
              </div>
            </details>
            <div className={css.formActions}><button type="button" disabled={busy} onClick={() => { setDefinitionEdit(null); setEditingId(null) }}>{t('cancel')}</button>
              <button type="button" disabled={busy || validDefinition === undefined}
                onClick={validDefinition === undefined ? undefined : () => { submitDefinition(validDefinition) }}>
                {t(editingId === null ? 'create' : 'saveDefinition')}
              </button></div>
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
