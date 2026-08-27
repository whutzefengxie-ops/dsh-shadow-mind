// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { ShadowReportCard, type ShadowReportCardProps } from '../src/client/ShadowReportCard.tsx'
import type { ShadowReviewCycle, ShadowRunView } from '../src/runtime/types.ts'

// The real primitive bundle ships node_modules CSS modules that vitest does not
// process; the card only renders plain text through it in these tests.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  MarkdownText: ({ text }: { text: string }) => text,
}))

afterEach(() => {
  cleanup()
})

const FAILED_RUN: ShadowRunView = {
  runId: 'run-failed',
  shadowId: 'reviewer',
  shadowName: 'Reviewer',
  capturedThroughSeq: 20,
  phase: 'failed',
  stage: 'run',
  startedAt: '2026-08-24T00:00:00.000Z',
  finishedAt: '2026-08-24T00:00:01.000Z',
  reasonCode: 'PROVIDER_ERROR',
  error: { name: 'ProviderError', message: 'boom' },
}

function cycle(runs: readonly ShadowRunView[]): ShadowReviewCycle {
  return { capturedThroughSeq: 20, scheduling: false, runs }
}

function mount(
  reviewCycle: ShadowReviewCycle,
  retry: ShadowReportCardProps['retry'],
) {
  const poke = vi.fn()
  const props = {
    node: { data: { capturedThroughSeq: 20, reports: [] } },
    sessionId: 'session-1' as unknown as SessionId,
    openSession: vi.fn(),
    useCycle: () => reviewCycle,
    retry,
    poke,
    t: (key: string) => key,
  } as unknown as ShadowReportCardProps
  render(<ShadowReportCard {...props} />)
  return { poke }
}

describe('ShadowReportCard retry', () => {
  it('shows a retry button for a failed run and retries it on click', async () => {
    const retry = vi.fn().mockResolvedValue(undefined)
    const { poke } = mount(cycle([FAILED_RUN]), retry)

    const button = screen.getByText('retryRun')
    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)

    expect(retry).toHaveBeenCalledWith('session-1', 'run-failed')
    await waitFor(() => {
      expect(poke).toHaveBeenCalledWith('session-1')
    })
  })

  it('shows a retry button for an aborted run but not for a report run', () => {
    const retry = vi.fn().mockResolvedValue(undefined)
    mount(cycle([
      { ...FAILED_RUN, runId: 'run-aborted', phase: 'aborted', stage: 'run', reasonCode: 'USER_MESSAGE_RECEIVED' },
      { ...FAILED_RUN, runId: 'run-report', phase: 'report', stage: 'relay', error: undefined, reasonCode: undefined },
    ]), retry)

    const buttons = screen.getAllByText('retryRun')
    expect(buttons).toHaveLength(1)
    // Only the aborted run carries the retry action; the report run does not.
    const retryingArticle = buttons[0]!.closest('article')
    expect(retryingArticle?.querySelector('code')?.textContent).toBe('reviewer')
    expect(retry).not.toHaveBeenCalled()
  })

  it('surfaces the rejection reason and re-enables the button afterwards', async () => {
    const retry = vi.fn().mockRejectedValue(new Error('the Shadow definition is disabled'))
    mount(cycle([FAILED_RUN]), retry)

    fireEvent.click(screen.getByText('retryRun'))
    await waitFor(() => {
      expect(screen.getByText('retryError: the Shadow definition is disabled')).toBeDefined()
    })
    expect(retry).toHaveBeenCalledTimes(1)
    expect((screen.getByText('retryRun') as HTMLButtonElement).disabled).toBe(false)
  })
})
