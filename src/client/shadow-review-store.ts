import { useCallback, useSyncExternalStore } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ShadowMindStatus, ShadowReviewCycle } from '../runtime/types.ts'

const POLL_INTERVAL_MS = 500
const EMPTY_CYCLES: readonly ShadowReviewCycle[] = Object.freeze([])

/** Fetch current lifecycle snapshots for one root session. */
export type ShadowCycleLoader = (sessionId: SessionId) => Promise<readonly ShadowReviewCycle[]>

/** Fetch the pause/resume-aware orchestration status for one root session. */
export type ShadowStatusLoader = (sessionId: SessionId) => Promise<ShadowMindStatus>

interface SessionCycles {
  snapshot: readonly ShadowReviewCycle[]
  status: ShadowMindStatus | undefined
  readonly listeners: Set<() => void>
  inFlight: Promise<void> | undefined
  statusInFlight: Promise<void> | undefined
  timer: ReturnType<typeof setTimeout> | undefined
}

/** One deduplicated Remote poller per mounted root session. */
export class ShadowReviewStore {
  private readonly sessions = new Map<SessionId, SessionCycles>()
  private disposed = false

  /** @param load Remote cycle snapshot loader. @param loadStatus Remote status loader. */
  constructor(
    private readonly load: ShadowCycleLoader,
    private readonly loadStatus: ShadowStatusLoader,
  ) {}

  /** Read the reference-stable cycle snapshot for React. */
  snapshot(sessionId: SessionId): readonly ShadowReviewCycle[] {
    return this.sessions.get(sessionId)?.snapshot ?? EMPTY_CYCLES
  }

  /** Read the reference-stable orchestration status for React. */
  status(sessionId: SessionId): ShadowMindStatus | undefined {
    return this.sessions.get(sessionId)?.status
  }

  /** Trigger an immediate refresh for one session (e.g. after a manual retry or pause). */
  poke(sessionId: SessionId): void {
    const entry = this.sessions.get(sessionId)
    if (entry === undefined || this.disposed) return
    entry.timer = setTimeout(() => {
      entry.timer = undefined
      void this.refresh(sessionId, entry)
    }, 0)
  }

  /** Subscribe one view and refresh immediately; concurrent mounts share one request. */
  subscribe(sessionId: SessionId, listener: () => void): () => void {
    const entry = this.entry(sessionId)
    entry.listeners.add(listener)
    void this.refresh(sessionId, entry)
    return () => {
      entry.listeners.delete(listener)
      if (entry.listeners.size !== 0) return
      if (entry.timer !== undefined) clearTimeout(entry.timer)
      this.sessions.delete(sessionId)
    }
  }

  /** Stop every timer and ignore later Remote settlements. */
  dispose(): void {
    this.disposed = true
    for (const entry of this.sessions.values()) {
      if (entry.timer !== undefined) clearTimeout(entry.timer)
    }
    this.sessions.clear()
  }

  private entry(sessionId: SessionId): SessionCycles {
    const current = this.sessions.get(sessionId)
    if (current !== undefined) return current
    const created: SessionCycles = {
      snapshot: EMPTY_CYCLES,
      status: undefined,
      listeners: new Set(),
      inFlight: undefined,
      statusInFlight: undefined,
      timer: undefined,
    }
    this.sessions.set(sessionId, created)
    return created
  }

  private refresh(sessionId: SessionId, entry: SessionCycles): Promise<void> {
    if (this.disposed) return Promise.resolve()
    void this.refreshStatus(sessionId, entry)
    if (entry.inFlight !== undefined) return entry.inFlight
    const request = this.load(sessionId).then((cycles) => {
      if (this.disposed || this.sessions.get(sessionId) !== entry) return
      entry.snapshot = Object.freeze([...cycles])
      for (const listener of entry.listeners) listener()
      const unsettled = this.unsettled(cycles)
      if (unsettled && entry.listeners.size > 0) this.schedule(sessionId, entry)
    }, () => {
      if (!this.disposed
        && this.sessions.get(sessionId) === entry
        && entry.listeners.size > 0
        && this.unsettled(entry.snapshot)) {
        this.schedule(sessionId, entry)
      }
    }).finally(() => {
      if (entry.inFlight === request) entry.inFlight = undefined
    })
    entry.inFlight = request
    return request
  }

  /** Load the pause/resume-aware status snapshot once per in-flight window. */
  private refreshStatus(sessionId: SessionId, entry: SessionCycles): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (entry.statusInFlight !== undefined) return entry.statusInFlight
    const request = this.loadStatus(sessionId).then((status) => {
      if (this.disposed || this.sessions.get(sessionId) !== entry) return
      entry.status = status
      for (const listener of entry.listeners) listener()
    }, () => {
      // Keep the last known status; the next poke or poll refreshes it.
    }).finally(() => {
      if (entry.statusInFlight === request) entry.statusInFlight = undefined
    })
    entry.statusInFlight = request
    return request
  }

  private schedule(sessionId: SessionId, entry: SessionCycles): void {
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = undefined
      void this.refresh(sessionId, entry)
    }, POLL_INTERVAL_MS)
  }

  private unsettled(cycles: readonly ShadowReviewCycle[]): boolean {
    return cycles.some(cycle => cycle.scheduling || cycle.runs.some(run => run.phase === 'running'
      || run.phase === 'report' && run.relayed !== true))
  }
}

/** Select one anchored cycle through React's external-store protocol. */
export function useShadowReviewCycle(
  store: ShadowReviewStore,
  sessionId: SessionId,
  capturedThroughSeq: number,
): ShadowReviewCycle | undefined {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(sessionId, listener),
    [store, sessionId],
  )
  const getSnapshot = useCallback(() => store.snapshot(sessionId), [store, sessionId])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    .find(cycle => cycle.capturedThroughSeq === capturedThroughSeq)
}

/** Select the pause/resume-aware orchestration status for one session. */
export function useShadowMindStatus(
  store: ShadowReviewStore,
  sessionId: SessionId,
): ShadowMindStatus | undefined {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(sessionId, listener),
    [store, sessionId],
  )
  const getSnapshot = useCallback(() => store.status(sessionId), [store, sessionId])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
