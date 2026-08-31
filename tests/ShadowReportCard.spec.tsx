// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { ShadowReportCard, type ShadowReportCardProps } from '../src/client/ShadowReportCard.tsx'
import type { ShadowMindStatus, ShadowReviewCycle, ShadowRunView } from '../src/runtime/types.ts'

// The real primitive bundle ships node_modules CSS modules that vitest does not
// process; the card only renders plain text through it in these tests.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  MarkdownText: ({ text }: { text: string }) => text,
  IconTriangleRightFill14: () => null,
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

const REPORT_RUN: ShadowRunView = {
  runId: 'run-report',
  shadowId: 'reviewer',
  shadowName: 'Reviewer',
  capturedThroughSeq: 20,
  phase: 'report',
  stage: 'relay',
  startedAt: '2026-08-24T00:00:00.000Z',
  finishedAt: '2026-08-24T00:00:01.000Z',
  childSessionId: 'child-1' as unknown as SessionId,
  content: 'The review report body',
  relayed: true,
}

function cycle(runs: readonly ShadowRunView[]): ShadowReviewCycle {
  return { capturedThroughSeq: 20, scheduling: false, runs }
}

function status(paused: boolean): ShadowMindStatus {
  return {
    paused,
    active: [],
    pendingSchedules: 0,
    epoch: 0,
    totalRuns: 1,
    valueLoop: [],
    spentChars: 0,
    budgetTier: 'standard',
    cooldowns: [],
    pendingEscalations: [],
    recentReviews: [],
  }
}

function mount(
  reviewCycle: ShadowReviewCycle,
  retry: ShadowReportCardProps['retry'],
  options: {
    paused?: boolean
    pause?: ShadowReportCardProps['pause']
    resume?: ShadowReportCardProps['resume']
    collapsedByDefault?: boolean
  } = {},
) {
  const poke = vi.fn()
  const props = {
    node: { data: { capturedThroughSeq: 20, reports: [] } },
    sessionId: 'session-1' as unknown as SessionId,
    openSession: vi.fn(),
    useCycle: () => reviewCycle,
    useStatus: () => status(options.paused ?? false),
    retry,
    pause: options.pause ?? vi.fn().mockResolvedValue(undefined),
    resume: options.resume ?? vi.fn().mockResolvedValue(undefined),
    poke,
    useCollapsedByDefault: () => options.collapsedByDefault ?? true,
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

describe('ShadowReportCard pause', () => {
  it('offers pause while running and pauses the session on click', async () => {
    const pause = vi.fn().mockResolvedValue(undefined)
    const { poke } = mount(cycle([FAILED_RUN]), vi.fn(), { pause })

    const button = screen.getByText('pauseReview')
    expect(button).toBeInstanceOf(HTMLButtonElement)
    fireEvent.click(button)

    expect(pause).toHaveBeenCalledWith('session-1')
    await waitFor(() => {
      expect(poke).toHaveBeenCalledWith('session-1')
    })
  })

  it('offers resume with a paused notice while paused and resumes on click', async () => {
    const resume = vi.fn().mockResolvedValue(undefined)
    const { poke } = mount(cycle([FAILED_RUN]), vi.fn(), { paused: true, resume })

    expect(screen.getByText('reviewPaused')).toBeDefined()
    fireEvent.click(screen.getByText('resumeReview'))

    expect(resume).toHaveBeenCalledWith('session-1')
    await waitFor(() => {
      expect(poke).toHaveBeenCalledWith('session-1')
    })
  })

  it('surfaces the pause rejection reason and re-enables the toggle afterwards', async () => {
    const pause = vi.fn().mockRejectedValue(new Error('the session is gone'))
    mount(cycle([FAILED_RUN]), vi.fn(), { pause })

    fireEvent.click(screen.getByText('pauseReview'))
    await waitFor(() => {
      expect(screen.getByText('pauseError: the session is gone')).toBeDefined()
    })
    expect((screen.getByText('pauseReview') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('ShadowReportCard collapse', () => {
  it('starts collapsed by default while the run header, phase, and meta row stay visible', () => {
    mount(cycle([REPORT_RUN]), vi.fn().mockResolvedValue(undefined))

    const toggle = screen.getByRole('button', { name: 'expandCard' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    // Only the report body is collapsed; the Shadow identity, its status
    // badge, and the child-session meta row below remain displayed.
    expect(screen.queryByText('The review report body')).toBeNull()
    expect(screen.getByText('Reviewer')).toBeDefined()
    expect(screen.getByText('reviewReport')).toBeDefined()
    expect(screen.getByRole('button', { name: 'openChildSession' })).toBeDefined()
  })

  it('expands and collapses the report content through the corner toggle', () => {
    mount(cycle([REPORT_RUN]), vi.fn().mockResolvedValue(undefined))

    fireEvent.click(screen.getByRole('button', { name: 'expandCard' }))
    expect(screen.getByText('The review report body')).toBeDefined()
    const collapse = screen.getByRole('button', { name: 'collapseCard' })
    expect(collapse.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(collapse)
    expect(screen.queryByText('The review report body')).toBeNull()
    expect(screen.getByRole('button', { name: 'expandCard' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('starts expanded when the settings preference asks for expanded cards', () => {
    mount(cycle([REPORT_RUN]), vi.fn().mockResolvedValue(undefined), { collapsedByDefault: false })

    expect(screen.getByText('The review report body')).toBeDefined()
    expect(screen.getByRole('button', { name: 'collapseCard' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('follows the settings preference live until a manual toggle pins the card', () => {
    // Simulates the Host settings mirror arriving after the card mounts: the
    // preference starts as the collapsed fallback and later resolves to
    // "expanded by default" on a re-render.
    let preference = true
    const retry = vi.fn().mockResolvedValue(undefined)
    const poke = vi.fn()
    const props = () => ({
      node: { data: { capturedThroughSeq: 20, reports: [] } },
      sessionId: 'session-1' as unknown as SessionId,
      openSession: vi.fn(),
      useCycle: () => cycle([REPORT_RUN]),
      useStatus: () => status(false),
      retry,
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      poke,
      useCollapsedByDefault: () => preference,
      t: (key: string) => key,
    }) as unknown as ShadowReportCardProps
    const { rerender } = render(<ShadowReportCard {...props()} />)

    // Collapsed while only the fallback preference stands.
    expect(screen.queryByText('The review report body')).toBeNull()

    // The mirror arrives with "expanded by default": the untouched card follows.
    preference = false
    rerender(<ShadowReportCard {...props()} />)
    expect(screen.getByText('The review report body')).toBeDefined()

    // A manual toggle away from the default pins the card; later preference
    // changes stop applying while it stays pinned.
    fireEvent.click(screen.getByRole('button', { name: 'collapseCard' }))
    expect(screen.queryByText('The review report body')).toBeNull()
    rerender(<ShadowReportCard {...props()} />)
    expect(screen.queryByText('The review report body')).toBeNull()
    preference = true
    rerender(<ShadowReportCard {...props()} />)
    expect(screen.queryByText('The review report body')).toBeNull()
    expect(screen.getByRole('button', { name: 'expandCard' }).getAttribute('aria-expanded')).toBe('false')

    // Toggling back to the current default clears the override instead of
    // pinning the opposite value, so the card resumes following the
    // preference: flipping the default expands it without another click.
    fireEvent.click(screen.getByRole('button', { name: 'expandCard' }))
    expect(screen.getByText('The review report body')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'collapseCard' }))
    expect(screen.queryByText('The review report body')).toBeNull()
    preference = false
    rerender(<ShadowReportCard {...props()} />)
    expect(screen.getByText('The review report body')).toBeDefined()
    expect(screen.getByRole('button', { name: 'collapseCard' }).getAttribute('aria-expanded')).toBe('true')
  })
})
