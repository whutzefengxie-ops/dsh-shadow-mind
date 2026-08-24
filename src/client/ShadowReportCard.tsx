import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { NS } from './index.ts'
import css from './ShadowReportCard.module.css'

/** Props for one Shadow report Chat row. */
export type ShadowReportCardProps = PropsRuntime<'conversation.chat.node', 'shadow-mind-report'>
  & PropsLocale<typeof NS> & InjectFace<ShadowReportCardInjected>

/** Browser actions injected into the report card. */
export interface ShadowReportCardInjected {
  readonly openSession: (sessionId: SessionId) => void
}

/** Display accepted Shadow reports where they entered the root conversation. */
export function ShadowReportCard({ node, openSession, t }: ShadowReportCardProps) {
  const data = node.data
  const countKey = data.reports.length === 1 ? 'reportCountOne' : 'reportCountOther'
  return (
    <section className={css.card} data-shadow-report-card>
      <header className={css.header}>
        <span className={css.mark} aria-hidden>S</span>
        <div>
          <strong>{t('reportCardTitle')}</strong>
          <span>{t(countKey, { count: data.reports.length })}</span>
        </div>
      </header>
      <div className={css.reports}>
        {data.reports.map(report => (
          <article className={css.report} key={report.runId}>
            <div className={css.reportHeader}>
              <strong>{report.name}</strong>
              <code>{report.shadowId}</code>
            </div>
            <pre className={css.content}>{report.content}</pre>
            <div className={css.meta}>
              <button
                type="button"
                title={report.childSessionId}
                aria-label={t('openChildSession', { id: report.childSessionId })}
                onClick={() => { openSession(report.childSessionId) }}
              >
                {t('childSession')}: <code>{report.childSessionId}</code>
              </button>
              <span>{t('reportCapturedSeq', { seq: report.capturedThroughSeq })}</span>
            </div>
          </article>
        ))}
      </div>
      <footer className={css.relay} data-shadow-relayed>
        <span className={css.dot} aria-hidden />
        <span>{t('relayedToRoot')}</span>
        <span className={css.count}>{t(countKey, { count: data.reports.length })}</span>
      </footer>
    </section>
  )
}
