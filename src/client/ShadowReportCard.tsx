import { useState } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ShadowReviewCycle, ShadowRunPhase, ShadowRunView } from '../runtime/types.ts'
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
  /** Manually re-run one failed or aborted run. */
  readonly retry: (sessionId: SessionId, runId: string) => Promise<unknown>
  /** Refresh the review cycle immediately after a retry is admitted. */
  readonly poke: (sessionId: SessionId) => void
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

function RunBody({ run, t }: { run: ShadowRunView; t: ShadowReportCardProps['t'] }) {
  if (run.phase === 'running') return <p className={css.message}>{t('reviewRunningDetail')}</p>
  if (run.phase === 'report') {
    return run.content === undefined
      ? <p className={css.message}>{t('reportWaitingRelay')}</p>
      : <div className={css.content}><MarkdownText text={run.content} /></div>
  }
  if (run.phase === 'silent') return <p className={css.message}>{t('reviewSilentDetail')}</p>
  if (run.phase === 'not_relevant') return <p className={css.message}>{t('reviewNotRelevantDetail')}</p>
  if (run.phase === 'aborted') return <p className={css.message}>{t('reviewAbortedDetail')}</p>
  return <p className={css.message}>{t('reviewFailedDetail')}</p>
}

/** Display a running placeholder and update the same row to every terminal phase. */
export function ShadowReportCard({ node, sessionId, openSession, useCycle, retry, poke, t }: ShadowReportCardProps) {
  const capturedThroughSeq = node.data.capturedThroughSeq
  const cycle = useCycle(sessionId, capturedThroughSeq)
  const runs = projectReviewRuns(cycle, node.data.reports)
  const [retryingRun, setRetryingRun] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  if (runs.length === 0 && cycle?.failure === undefined && cycle?.scheduling !== true) {
    return <span hidden data-shadow-review-empty />
  }
  const running = cycle?.scheduling === true || runs.some(run => run.phase === 'running')
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
  return (
    <section className={css.card} data-shadow-review-card aria-live={running ? 'polite' : undefined}>
      <header className={css.header}>
        <span className={css.mark} aria-hidden>S</span>
        <div>
          <strong>{t('reviewCardTitle')}</strong>
          <span>{t('reviewRunCount', { count: runs.length })}</span>
        </div>
      </header>
      {running ? (
        <div className={css.warning} role="status" data-shadow-running-warning>
          <span className={css.spinner} aria-hidden />
          <span>{t('reviewInputWarning')}</span>
        </div>
      ) : null}
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
          <article className={css.run} key={run.runId} data-shadow-run-phase={run.phase}>
            <div className={css.runHeader}>
              <div><strong>{run.shadowName}</strong><code>{run.shadowId}</code></div>
              <span className={css.phase}>{phaseLabel(run.phase, t)}</span>
            </div>
            <RunBody run={run} t={t} />
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
