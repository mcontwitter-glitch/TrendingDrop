import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  kind: ToastKind
  title: string
  message?: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  push: (kind: ToastKind, title: string, message?: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastSeq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = `toast-${++toastSeq}`
      setToasts((t) => [...t.slice(-4), { id, kind, title, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
      dismiss,
    }),
    [toasts, push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastBanner />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Safe no-op when provider missing (tests / partial trees)
    return {
      toasts: [],
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
      dismiss: () => undefined,
    }
  }
  return ctx
}

function ToastBanner() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(100vw-2rem,24rem)] flex-col gap-2">
      {toasts.map((t) => {
        const styles =
          t.kind === 'success'
            ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
            : t.kind === 'error'
              ? 'border-red-400/40 bg-red-500/15 text-red-100'
              : 'border-purple-400/30 bg-purple-500/15 text-purple-100'
        const Icon =
          t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
        return (
          <div
            key={t.id}
            className={`pointer-events-auto fade-up flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg shadow-black/40 backdrop-blur ${styles}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-snug">{t.title}</div>
              {t.message && (
                <div className="mt-0.5 break-words text-xs opacity-90">{t.message}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 opacity-70 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
