import { useId, type ReactNode } from 'react'

/** Label + control + hint row. `children` receives the id to bind the control to the label. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      {children(id)}
      {(error ?? hint) && (
        <p
          className={
            error
              ? 'mt-1.5 text-[12.5px] text-status-replace-ink'
              : 'mt-1.5 text-[12.5px] text-ink-muted'
          }
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
