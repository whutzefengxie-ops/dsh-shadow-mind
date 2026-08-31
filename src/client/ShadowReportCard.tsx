import { useState } from 'react'
import { IconTriangleRightFill14, MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ShadowMindStatus, ShadowReviewCycle, ShadowRunPhase, ShadowRunView } from '../runtime/types.ts'
import type { NS } from './index.ts'
import { projectReviewRuns } from './shadow-report-projection.ts'
import css from './ShadowReportCard.module.css'

/** Props for one Shadow review row. */
export type ShadowReportCardProps = PropsRuntime<'conversation.chat.node', 'shadow-mind-review'>
  & PropsLocale<typeof NS> & InjectFace<ShadowReportCardInjected>

/** Props for the invisible relay companion row. */
export type ShadowRelayMarkerProps = PropsRuntime<'conversation.chat.node', 'shadow-mind-relay-marker'>

/** Browser state and actions injected into the review card. */
export interface ShadowReportCardInjected {
  readonly openSession: (sessionId: SessionId) => void
  readonly useCycle: (sessionId: SessionId, capturedThroughSeq: number) => ShadowReviewCycle | undefined
  /** Manually re-run one failed or aborted run of a specific Shadow subagent. */
  readonly retry: (sessionId: SessionId, runId: string) => Promise<unknown>
  /** Read the pause/resume-aware orchestration status for the session. */
  readonly useStatus: (sessionId: SessionId) => ShadowMindStatus | undefined
  /** Pause scheduling and cancel admitted Shadow work for the session. */
  readonly pause: (sessionId: SessionId) => Promise<unknown>
  /** Resume scheduling for a paused session. */
  readonly resume: (sessionId: SessionId) => Promise<unknown>
  /** Refresh the review cycle immediately after a retry or pause is admitted. */
  readonly poke: (sessionId: SessionId) => void
  /** Current collapsed-by-default preference for new cards. */
  readonly useCollapsedByDefault: () => boolean
}

function phaseLabel(phase: ShadowRunPhase, t: ShadowReportCardProps['t']): string {
  switch (phase) {
    case 'running': return t('reviewRunning')
    case 'report': return t('reviewReport')
    case 'silent': return t('reviewSilent')
    case 'not_relevant': return t('reviewNotRelevant')
    case 'aborted': return t('reviewAborted')
    case 'failed': return t('reviewFailed')
  }
}

function markdownLabels(t: ShadowReportCardProps['t']): MarkdownLabels {
  return {
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('markdown.footnotes'),
  }
}

function RunBody({ run, t }: { run: ShadowRunView; t: ShadowReportCardProps['t'] }) {
  if (run.phase === 'running') return <p className={css.message}>{t('reviewRunningDetail')}</p>
  if (run.phase === 'report') {
    return run.content === undefined
      ? <p className={css.message}>{t('reportWaitingRelay')}</p>
      : <div className={css.content}><MarkdownText text={run.content} labels={markdownLabels(t)} /></div>
  }
  if (run.phase === 'silent') return <p className={css.message}>{t('reviewSilentDetail')}</p>
  if (run.phase === 'not_relevant') return <p className={css.message}>{t('reviewNotRelevantDetail')}</p>
  if (run.phase === 'aborted') return <p className={css.message}>{t('reviewAbortedDetail')}</p>
  return <p className={css.message}>{t('reviewFailedDetail')}</p>
}

/** Display a running placeholder and update the same row to every terminal phase. */
export function ShadowReportCard({
  node, sessionId, openSession, useCycle, useStatus, retry, pause, resume, poke, useCollapsedByDefault, t,
}: ShadowReportCardProps) {
  const capturedThroughSeq = node.data.capturedThroughSeq
  const cycle = useCycle(sessionId, capturedThroughSeq)
  const status = useStatus(sessionId)
  const runs = projectReviewRuns(cycle, node.data.reports)
  const collapsedByDefault = useCollapsedByDefault()
  // Manual override separated from the live preference: until the user toggles
  // this card, it follows `collapsedByDefault` in real time, so a card mounted
  // while the Host settings mirror is still loading settles into the saved
  // preference once the mirror arrives instead of freezing at the collapsed
  // fallback. Toggling away from the current default pins the card; toggling
  // back to the default state clears the override and resumes live following.
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null)
  const collapsed = manualCollapsed ?? collapsedByDefault
  const toggleCollapsed = (): void => {
    setManualCollapsed(current => {
      const next = current === null ? !collapsedByDefault : !current
      return next === collapsedByDefault ? null : next
    })
  }
  const [retryingRun, setRetryingRun] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [pausing, setPausing] = useState(false)
  const [pauseError, setPauseError] = useState<string | null>(null)
  if (runs.length === 0 && cycle?.failure === undefined && cycle?.scheduling !== true) {
    return <span hidden data-shadow-review-empty />
  }
  const running = cycle?.scheduling === true || runs.some(run => run.phase === 'running')
  const paused = status?.paused === true
  const runRetry = (runId: string): void => {
    setRetryingRun(runId)
    setRetryError(null)
    void retry(sessionId, runId).then(
      () => { poke(sessionId) },
      (error: unknown) => {
        setRetryError(error instanceof Error ? error.message : String(error))
      },
    ).finally(() => { setRetryingRun(null) })
  }
  const runPauseToggle = (): void => {
    setPausing(true)
    setPauseError(null)
    void (paused ? resume(sessionId) : pause(sessionId)).then(
      () => { poke(sessionId) },
      (error: unknown) => {
        setPauseError(error instanceof Error ? error.message : String(error))
      },
    ).finally(() => { setPausing(false) })
  }
  return (
    <section
      className={css.card}
      data-shadow-review-card
      data-shadow-card-collapsed={collapsed || undefined}
      aria-live={running ? 'polite' : undefined}
    >
      <header className={css.header}>
        <span className={css.mark} aria-hidden>S</span>
        <div className={css.headerTitle}>
          <strong>{t('reviewCardTitle')}</strong>
          <span>{t('reviewRunCount', { count: runs.length })}</span>
        </div>
        <div className={css.headerActions}>
          <button
            type="button"
            disabled={pausing}
            aria-label={paused ? t('resumeReview') : t('pauseReview')}
            data-shadow-pause-toggle
            onClick={runPauseToggle}
          >
            {pausing ? t('pausePending') : t(paused ? 'resumeReview' : 'pauseReview')}
          </button>
        </div>
        <button
          type="button"
          className={`${css.toggle} ${collapsed ? '' : css.toggleExpanded}`}
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? 'expandCard' : 'collapseCard')}
          title={t(collapsed ? 'expandCard' : 'collapseCard')}
          data-shadow-card-toggle
          onClick={toggleCollapsed}
        >
          <IconTriangleRightFill14 />
        </button>
      </header>
      {running ? (
        <div className={css.warning} role="status" data-shadow-running-warning>
          <span className={css.spinner} aria-hidden />
          <span>{t('reviewInputWarning')}</span>
        </div>
      ) : null}
      {paused ? (
        <div className={css.warning} role="status" data-shadow-review-paused>
          <span>{t('reviewPaused')}</span>
        </div>
      ) : null}
      {pauseError === null ? null : <p className={css.error}>{t('pauseError')}: {pauseError}</p>}
      {cycle?.failure === undefined ? null : (
        <article className={css.run} data-shadow-run-phase="failed">
          <div className={css.runHeader}>
            <strong>{t('reviewScheduling')}</strong>
            <span className={css.phase}>{t('reviewFailed')}</span>
          </div>
          <p className={css.message}>{cycle.failure.error.message}</p>
          <div className={css.meta}>
            <code>{cycle.failure.reasonCode}</code>
            <span>{t('reviewStage')}: {cycle.failure.stage}</span>
          </div>
        </article>
      )}
      {cycle?.scheduling !== true || runs.length > 0 ? null : (
        <article className={css.run} data-shadow-run-phase="running">
          <div className={css.runHeader}>
            <strong>{t('reviewScheduling')}</strong>
            <span className={css.phase}>{t('reviewRunning')}</span>
          </div>
          <p className={css.message}>{t('reviewSchedulingDetail')}</p>
        </article>
      )}
      <div className={css.runs}>
        {runs.map(run => (
          <article
            className={css.run}
            key={run.runId}
            data-shadow-run-phase={run.phase}
            data-shadow-run-collapsed={collapsed || undefined}
          >
            <div className={css.runHeader}>
              <div><strong>{run.shadowName}</strong><code>{run.shadowId}</code></div>
              <span className={css.phase}>{phaseLabel(run.phase, t)}</span>
            </div>
            {/* Collapsing hides only the report body; the run header above and
                the subagent id / run status rows below stay visible. */}
            {collapsed ? null : <RunBody run={run} t={t} />}
            <div className={css.meta}>
              {run.childSessionId === undefined ? null : (
                <button
                  type="button"
                  title={run.childSessionId}
                  aria-label={t('openChildSession', { id: run.childSessionId })}
                  onClick={() => { openSession(run.childSessionId!) }}
                >
                  {t('childSession')}: <code>{run.childSessionId}</code>
                </button>
              )}
              {(run.phase === 'failed' || run.phase === 'aborted') ? (
                <button
                  type="button"
                  disabled={retryingRun !== null || running}
                  data-shadow-retry
                  onClick={() => { runRetry(run.runId) }}
                >
                  {retryingRun === run.runId ? t('retrying') : t('retryRun')}
                </button>
              ) : null}
              <span>{t('reportCapturedSeq', { seq: run.capturedThroughSeq })}</span>
              <span>{t('reviewStage')}: <code>{run.stage}</code></span>
              {run.reasonCode === undefined ? null : <span>{t('reviewReason')}: <code>{run.reasonCode}</code></span>}
              {run.providerStopReason === undefined ? null : (
                <span>{t('reviewProviderStop')}: <code>{run.providerStopReason}</code></span>
              )}
            </div>
            {retryError === null ? null : <p className={css.error}>{t('retryError')}: {retryError}</p>}
            {run.error === undefined ? null : <p className={css.error}>{run.error.name}: {run.error.message}</p>}
            {run.phase !== 'report' ? null : (
              <footer className={css.relay} data-shadow-relayed={run.relayed === true ? 'true' : 'false'}>
                <span className={css.dot} aria-hidden />
                <span>{t(run.relayed === true ? 'relayedToRoot' : 'reportWaitingRelay')}</span>
              </footer>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

/** Render no content; the row exists so its adjacent Context node can be hidden. */
export function ShadowRelayMarker(_props: ShadowRelayMarkerProps) {
  return <span hidden data-shadow-relay-marker />
}
