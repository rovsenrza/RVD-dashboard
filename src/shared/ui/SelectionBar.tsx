import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

/**
 * The bulk-action bar of a table with ticked rows: how many, a way to clear
 * them, and the actions. It sticks to the bottom of the scrolling page, so it
 * stays in reach while the user keeps ticking; on phones it spans the width.
 * Being sticky, not fixed, it needs no room reserved under the page.
 */
export function SelectionBar({
  count,
  onClear,
  note,
  label = 'Выбранные строки',
  children,
}: {
  count: number
  onClear: () => void
  /** One short line beside the count, e.g. a limit */
  note?: ReactNode
  label?: string
  children: ReactNode
}) {
  return (
    <div className="sticky bottom-4 z-20 mt-4 flex justify-center max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="region"
        aria-label={label}
        className="flex max-w-full items-center gap-x-3 rounded-xl bg-pop py-2 pr-2 pl-4 shadow-pop max-sm:w-full"
      >
        <span className="min-w-0">
          <span className="block text-ui font-medium whitespace-nowrap tabular">
            Выбрано: {count}
          </span>
          {note && <span className="block text-label text-ink-muted">{note}</span>}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Phones keep one row: the clear action shrinks to its icon. */}
          <Button variant="ghost" size="sm" icon={X} onClick={onClear} className="max-sm:hidden">
            Снять выбор
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            icon={X}
            onClick={onClear}
            aria-label="Снять выбор"
            className="sm:hidden"
          />
          {children}
        </div>
      </div>
    </div>
  )
}
