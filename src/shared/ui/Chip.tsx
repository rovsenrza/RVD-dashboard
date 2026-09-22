import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** Removable filter chip. */
export function Chip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-soft py-1 pl-2.5 text-label font-medium text-brand-deep">
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Убрать фильтр"
          className="grid size-6 place-items-center rounded-full hover:bg-brand/30"
        >
          <X size={12} strokeWidth={2} />
        </button>
      ) : (
        <span className="w-2.5" />
      )}
    </span>
  )
}
