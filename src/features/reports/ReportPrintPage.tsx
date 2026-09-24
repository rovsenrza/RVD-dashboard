import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import type { ProductStatus, Report } from '@/entities/types'
import { STATUS_COLOR, STATUS_TEXT_CLASS } from '@/entities/product'
import { reportMeta, reportText } from '@/entities/report'
import { useSession } from '@/app/session'
import { useReport } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import { Button, EmptyValue, ErrorState, SimpleTable, Skeleton } from '@/shared/ui'
import { reportLines, rowCount } from './reportFiles'

/** Paper is white whatever the screen theme; the choice comes back when the view closes. */
function useLightPaper(title: string | null) {
  useEffect(() => {
    const root = document.documentElement
    const theme = root.dataset.theme
    const pageTitle = document.title
    root.dataset.theme = 'light'
    if (title) document.title = title
    return () => {
      if (theme) root.dataset.theme = theme
      else delete root.dataset.theme
      document.title = pageTitle
    }
  }, [title])
}

/**
 * A report laid out for A4 landscape (Д21). «PDF» opens it in its own tab and
 * calls the print dialog, where «Сохранить как PDF» makes the file; the BFF
 * will render this same view to `.pdf` with headless Chromium.
 */
export function ReportPrintPage() {
  const [params] = useSearchParams()
  const { user, company } = useSession()
  const meta = reportMeta(params.get('r'))
  const allowed = user.role === 'manager' || user.role === 'admin'
  const query = useReport(meta && allowed ? meta.id : null, {
    branch: params.get('branch'),
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })
  const report = query.data
  useLightPaper(report ? `${report.title} — ${formatDate(report.generatedAt)}` : null)

  // Print once, after the fonts are in: a refetch on focus must not reopen the dialog.
  const printed = useRef(false)
  const auto = params.get('print') === '1'
  useEffect(() => {
    if (!auto || !report || printed.current) return
    let cancelled = false
    document.fonts.ready.then(() => {
      if (cancelled || printed.current) return
      printed.current = true
      window.print()
    })
    return () => {
      cancelled = true
    }
  }, [auto, report])

  const back = `/reports${meta ? `?r=${meta.id}` : ''}`

  return (
    <div className="min-h-dvh bg-field print:bg-sheet">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 bg-sheet px-5 py-3 shadow-sheet print:hidden">
        <Link
          to={back}
          className="inline-flex items-center gap-1.5 text-ui text-ink-secondary hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />К отчётам
        </Link>
        <p className="text-label text-ink-muted max-sm:order-last max-sm:w-full">
          В окне печати выберите «Сохранить как PDF» — файл сохранится с названием отчёта и датой.
        </p>
        <Button
          size="sm"
          icon={Printer}
          onClick={() => window.print()}
          disabled={!report}
          className="ml-auto"
        >
          Печать или PDF
        </Button>
      </div>

      <article className="mx-auto my-6 max-w-[74rem] bg-sheet px-10 py-9 shadow-sheet print:m-0 print:max-w-none print:p-0 print:shadow-none max-sm:mx-0 max-sm:my-0 max-sm:px-4 max-sm:py-6">
        {!meta || !allowed ? (
          <ErrorState
            message={
              !meta
                ? 'Такого отчёта нет — вернитесь к списку отчётов.'
                : 'Отчёты доступны руководителю и администратору.'
            }
          />
        ) : query.isError ? (
          <ErrorState message="Отчёт не построился." onRetry={() => query.refetch()} />
        ) : !report ? (
          <div className="grid gap-3" role="status" aria-label="Загрузка">
            <Skeleton className="h-6 w-1/3" />
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : (
          <Paper report={report} company={company.name} />
        )}
      </article>
    </div>
  )
}

function Paper({ report, company }: { report: Report; company: string }) {
  const [, ...scope] = reportLines(report, company)
  const numeric = new Set(report.columns.filter((c) => c.type === 'number').map((c) => c.key))
  const columns = report.columns.map((c) => ({
    key: c.key,
    header: c.header,
    align: numeric.has(c.key) ? ('right' as const) : undefined,
  }))
  const rows = useMemo(
    () =>
      report.rows.map((r) =>
        Object.fromEntries(
          report.columns.map((c) => {
            const text = reportText(c, r[c.key])
            if (c.type === 'status' && r[c.key]) {
              const s = r[c.key] as ProductStatus
              return [
                c.key,
                <span
                  key={c.key}
                  className={`inline-flex items-center gap-1.5 ${STATUS_TEXT_CLASS[s]}`}
                >
                  <span
                    className="size-1.5 rounded-full [print-color-adjust:exact]"
                    style={{ background: STATUS_COLOR[s] }}
                  />
                  {text}
                </span>,
              ]
            }
            return [c.key, text ?? <EmptyValue key={c.key} />]
          }),
        ),
      ),
    [report],
  )
  const footer = report.totals
    ? Object.fromEntries(
        report.columns.map((c) => [c.key, reportText(c, report.totals![c.key] ?? null)]),
      )
    : null

  return (
    <>
      <header className="flex items-center justify-between gap-6 border-b border-line pb-3 text-label text-ink-muted">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid size-5 place-items-center rounded-md bg-brand [print-color-adjust:exact]">
            <span className="size-2 rounded-full border-2 border-on-brand" />
          </span>
          РВД Кабинет
        </span>
        <span>{company}</span>
      </header>
      <h1 className="mt-6 text-title font-semibold tracking-[-0.02em] text-balance">
        {report.title}
      </h1>
      <p className="mt-1 text-ui text-ink-muted">
        {[...scope, rowCount(report.rows.length)].join(' · ')}
      </p>
      {report.rows.length ? (
        <SimpleTable className="mt-6" columns={columns} rows={rows} footer={footer} />
      ) : (
        <p className="mt-8 text-sm text-ink-secondary">В отчёт ничего не попало.</p>
      )}
    </>
  )
}
