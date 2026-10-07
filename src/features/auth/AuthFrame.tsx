import type { ReactNode } from 'react'
import { CrimpDrawing } from './CrimpDrawing'

/**
 * The screens before the cabinet opens (customer reference, 2026-10-07): dark in
 * both themes — the brand's black and amber — the form straight on the ground,
 * and beside it, on wide screens, a drawing of what the supplier makes.
 */
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
    <main className="theme-dark grid min-h-full bg-rail text-ink lg:grid-cols-2">
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <span className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-ink">
            <img src="/brand/vgiz-yellow.svg" alt="ВГИЗ" className="h-8 w-auto" />
            <span className="leading-none">
              РВД Кабинет
              <span className="mt-0.5 block text-micro font-normal tracking-wide text-ink-muted uppercase">
                личный кабинет
              </span>
            </span>
          </span>

          <h1 className="mt-12 text-title font-semibold tracking-[-0.02em] text-balance">
            {title}
          </h1>
          <p className="mt-1.5 mb-7 text-ui text-ink-muted">{lead}</p>
          {children}

          <p className="mt-8 text-label text-ink-muted">{footer}</p>
        </div>
      </section>

      <aside className="drafting-grid relative hidden overflow-hidden bg-field lg:block">
        <CrimpDrawing className="absolute inset-x-10 inset-y-12 h-[calc(100%-6rem)] w-[calc(100%-5rem)]" />
        <p className="absolute bottom-8 left-10 text-caption text-ink-muted">
          РВД в сборе и матрица обжимного станка
        </p>
      </aside>
    </main>
  )
}
