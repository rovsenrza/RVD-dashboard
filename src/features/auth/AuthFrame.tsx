import type { ReactNode } from 'react'

/** The screens before the cabinet opens: its name, one sheet with the form, a line under it. */
export function AuthFrame({
  title,
  lead,
  footer,
  children,
}: {
  title: string
  lead: string
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand">
            <span className="size-3.5 rounded-full border-[3px] border-on-brand" />
          </span>
          <span className="leading-none">
            <span className="block text-heading font-semibold tracking-[-0.01em]">РВД Кабинет</span>
            <span className="mt-1 block text-micro font-normal tracking-wide text-ink-muted uppercase">
              личный кабинет
            </span>
          </span>
        </div>

        <div className="sheet p-6">
          <h1 className="text-heading font-semibold tracking-[-0.01em]">{title}</h1>
          <p className="mt-1 mb-5 text-ui text-ink-muted">{lead}</p>
          {children}
        </div>

        <p className="mt-6 text-center text-label text-ink-muted">{footer}</p>
      </div>
    </main>
  )
}
