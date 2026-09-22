import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type ToastTone = 'ok' | 'error'
interface Toast {
  id: number
  message: string
  tone: ToastTone
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {})

export const useToast = () => useContext(ToastContext)

const DISMISS_AFTER_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, tone: ToastTone = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((list) => [...list, { id, message, tone }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), DISMISS_AFTER_MS)
  }, [])

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end">
          {toasts.map((t) => {
            const Icon = t.tone === 'ok' ? CheckCircle2 : AlertCircle
            return (
              <div
                key={t.id}
                role="status"
                className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl bg-pop px-3.5 py-3 text-ui shadow-pop"
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={cn(
                    'shrink-0',
                    t.tone === 'ok' ? 'text-status-ok-ink' : 'text-status-replace-ink',
                  )}
                />
                {t.message}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
