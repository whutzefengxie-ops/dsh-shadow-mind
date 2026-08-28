/** Linear, fixed-position toast stack for operation feedback in the settings tab. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import css from './ShadowMindSettingsTab.module.css'

/** One transient operation notice. */
export interface Toast {
  readonly id: number
  readonly kind: 'success' | 'error' | 'info'
  readonly text: string
}

/** Lifetime for one toast in milliseconds, by kind. */
const TOAST_LIFETIME_MS: Readonly<Record<Toast['kind'], number>> = {
  success: 3000,
  info: 4000,
  error: 6000,
}

/**
 * Own a bounded stack of auto-dismissing toasts.
 * @returns The live toasts plus push and dismiss operations.
 */
export function useToasts(): {
  readonly toasts: readonly Toast[]
  readonly push: (kind: Toast['kind'], text: string) => void
  readonly dismiss: (id: number) => void
} {
  const [toasts, setToasts] = useState<readonly Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.current.delete(id)
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextId.current
    nextId.current += 1
    setToasts(current => [...current.slice(-4), { id, kind, text }])
    timers.current.set(id, setTimeout(() => { dismiss(id) }, TOAST_LIFETIME_MS[kind]))
  }, [dismiss])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  return { toasts, push, dismiss }
}

/** Render the newest toast on top of a fixed bottom-right linear stack. */
export function ToastStack(props: {
  readonly toasts: readonly Toast[]
  readonly dismissLabel: string
  readonly onDismiss: (id: number) => void
}): ReactNode {
  if (props.toasts.length === 0) return null
  return (
    <div className={css.toastStack} aria-live="polite">
      {[...props.toasts].reverse().map(toast => (
        <div
          key={toast.id}
          className={css.toast}
          data-kind={toast.kind}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <span className={css.toastText}>{toast.text}</span>
          <button
            type="button"
            className={css.toastDismiss}
            aria-label={props.dismissLabel}
            onClick={() => { props.onDismiss(toast.id) }}
          >×</button>
        </div>
      ))}
    </div>
  )
}
