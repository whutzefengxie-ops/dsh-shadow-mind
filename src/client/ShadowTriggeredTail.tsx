import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ShadowMindReportStepData } from './shadow-report-conversation.ts'
import type { NS } from './index.ts'
import css from './ShadowTriggeredTail.module.css'

/** Selector-matched Shadow report trigger marker props. */
export type ShadowTriggeredTailProps = {
  matched: ShadowMindReportStepData
} & PropsLocale<typeof NS> & InjectFace<ShadowTriggeredTailInjected>

/** Browser actions injected into the report tail. */
export interface ShadowTriggeredTailInjected {
  readonly openSession: (sessionId: SessionId) => void
}

/** Mark a completed root response as caused by durable Shadow report input. */
export function ShadowTriggeredTail({ matched, openSession, t }: ShadowTriggeredTailProps) {
  const countKey = matched.reports.length === 1 ? 'reportCountOne' : 'reportCountOther'
  return (
    <section className={css.card} data-shadow-report-card>
      <header className={css.header}>
        <span className={css.mark} aria-hidden>S</span>
        <div>
          <strong>{t('reportCardTitle')}</strong>
          <span>{t(countKey, { count: matched.reports.length })}</span>
        </div>
      </header>
      <div className={css.reports}>
        {matched.reports.map(report => (
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
      <footer className={css.root} data-shadow-triggered>
        <span className={css.dot} aria-hidden />
        <span>{t('triggeredReply')}</span>
        <span className={css.count}>{t(countKey, { count: matched.reports.length })}</span>
      </footer>
    </section>
  )
}
