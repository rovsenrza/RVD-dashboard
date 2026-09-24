import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet, Lock, Printer } from 'lucide-react'
import type { ProductStatus, Report, ReportValue } from '@/entities/types'
import { ProductStatusBadge } from '@/entities/product'
import {
  periodText,
  PRESET_LABEL,
  presetPeriod,
  REPORTS,
  reportMeta,
  reportText,
  type PeriodPreset,
} from '@/entities/report'
import { useSession } from '@/app/session'
import { useReport } from '@/shared/api/queries'
import { cn, formatDate } from '@/shared/lib/utils'
import {
  Button,
  Card,
  DataTable,
  DatePicker,
  EmptyState,
  Field,
  PageHeader,
  QueryState,
  SegmentedControl,
  Select,
  Skeleton,
  useToast,
  valueOr,
} from '@/shared/ui'
import { downloadReportXlsx, printUrl, rowCount } from './reportFiles'

type Row = Record<string, ReportValue>

const PRESETS: PeriodPreset[] = ['30', '90', '365', 'custom']
const periodKind = (dir: 'past' | 'future' | null) =>
  dir === 'past' ? 'За период' : dir === 'future' ? 'На период вперёд' : 'На сегодня'

/** The preview reads like the paper: statuses as badges, dates and numbers formatted. */
const previewColumns = (report: Report): ColumnDef<Row, unknown>[] =>
  report.columns.map((c, i) => ({
    id: c.key,
    accessorFn: (r) => r[c.key],
    header: c.header,
    meta: { mobile: i === 0 ? 'title' : c.type === 'status' ? 'aside' : undefined },
    cell: (ctx) => {
      const value = ctx.getValue() as ReportValue
      if (c.type === 'status' && value)
        return <ProductStatusBadge status={value as ProductStatus} />
      const text = valueOr(reportText(c, value))
      return i === 0 ? <span className="font-medium">{text}</span> : text
    },
  }))

/**
 * «Отчёты» (Д21, ТЗ §4): seven reports over the branch in scope, built by the
 * server over all data; previewed here, taken away as Excel or PDF.
 */
export function ReportsPage() {
  const { user, company, branch } = useSession()
  const toast = useToast()
  const allowed = user.role === 'manager' || user.role === 'admin'
  const [params, setParams] = useSearchParams()
  const [saving, setSaving] = useState(false)

  const meta = reportMeta(params.get('r')) ?? REPORTS[0]
  const preset = PRESETS.find((p) => p === params.get('period')) ?? '30'
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const period = useMemo(() => {
    if (!meta.period) return null
    if (preset !== 'custom') return presetPeriod(preset, meta.period)
    return from && to && from <= to ? { from, to } : null
  }, [meta.period, preset, from, to])

  const query = useReport(allowed && (!meta.period || period) ? meta.id : null, {
    branch: branch?.id ?? null,
    from: period?.from,
    to: period?.to,
  })

  /** Another report; a period only carries over when it runs the same way. */
  const open = (id: string) => {
    const next = reportMeta(id) ?? REPORTS[0]
    set({
      r: next.id === REPORTS[0].id ? null : next.id,
      ...(next.period !== meta.period && { period: null, from: null, to: null }),
    })
  }

  const set = (patch: Record<string, string | null>) => {
    for (const [key, value] of Object.entries(patch))
      if (value) params.set(key, value)
      else params.delete(key)
    setParams(params, { replace: true })
  }

  const choosePreset = (next: PeriodPreset) =>
    next === 'custom'
      ? // Start the custom range from what was on screen, not from empty fields.
        set({ period: 'custom', from: period?.from ?? null, to: period?.to ?? null })
      : set({ period: next === '30' ? null : next, from: null, to: null })

  const xlsx = async (report: Report) => {
    setSaving(true)
    try {
      await downloadReportXlsx(report, company.name)
    } catch {
      toast('Не удалось сформировать файл Excel, попробуйте ещё раз', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Отчёты"
        description={`Строятся по всем данным ${branch ? `филиала «${branch.name}»` : 'всех филиалов'}, не по странице · Excel и PDF`}
      />
      {!allowed ? (
        <EmptyState
          icon={Lock}
          title="Отчёты доступны руководителю и администратору"
          description="Нужен отчёт — попросите руководителя или администратора кабинета."
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[17rem_1fr]">
          <Card padded={false} className="max-lg:hidden">
            <nav aria-label="Отчёты" className="grid gap-0.5 p-2">
              {REPORTS.map((r) => {
                const current = r.id === meta.id
                return (
                  <Button
                    key={r.id}
                    variant="ghost"
                    size="auto"
                    aria-current={current ? 'true' : undefined}
                    onClick={() => open(r.id)}
                    className={cn(
                      'h-auto w-full flex-col items-start gap-0 px-3 py-2',
                      current && 'bg-brand-soft text-ink hover:bg-brand-soft',
                    )}
                  >
                    <span className="text-sm font-medium text-ink">{r.title}</span>
                    <span className="text-label text-ink-muted">{periodKind(r.period)}</span>
                  </Button>
                )
              })}
            </nav>
          </Card>

          <Card className="min-w-0">
            <Select
              aria-label="Отчёт"
              value={meta.id}
              onChange={(e) => open(e.target.value)}
              options={REPORTS.map((r) => ({ value: r.id, label: r.title }))}
              className="mb-4 lg:hidden"
            />
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="max-w-2xl min-w-0">
                {/* On phones the select above already names the report. */}
                <h2 className="text-sheet-title font-semibold tracking-[-0.01em] max-lg:sr-only">
                  {meta.title}
                </h2>
                <p className="text-ui text-ink-muted lg:mt-1">{meta.description}</p>
              </div>
              <div className="flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
                <Button
                  size="sm"
                  icon={FileSpreadsheet}
                  disabled={!query.data || saving}
                  onClick={() => query.data && xlsx(query.data)}
                >
                  {saving ? 'Готовим…' : 'Excel'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Printer}
                  disabled={!query.data}
                  onClick={() =>
                    window.open(printUrl(meta, branch?.id ?? null, period), '_blank', 'noopener')
                  }
                >
                  PDF
                </Button>
              </div>
            </div>

            {meta.period && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <SegmentedControl
                  label="Период"
                  value={preset}
                  onChange={choosePreset}
                  options={PRESETS.map((p) => ({ value: p, label: PRESET_LABEL[p] }))}
                  className="max-sm:w-full"
                />
                {preset === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 max-sm:w-full sm:w-80">
                    <Field label="С">
                      {(id) => (
                        <DatePicker
                          id={id}
                          value={from}
                          max={to || undefined}
                          onChange={(v) => set({ from: v || null })}
                        />
                      )}
                    </Field>
                    <Field label="По">
                      {(id) => (
                        <DatePicker
                          id={id}
                          value={to}
                          min={from || undefined}
                          onChange={(v) => set({ to: v || null })}
                        />
                      )}
                    </Field>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5">
              {meta.period && !period ? (
                <EmptyState
                  inset
                  title="Укажите период"
                  description="Нужны обе даты, и начало не позже конца."
                />
              ) : (
                <QueryState
                  query={query}
                  skeleton={
                    <div className="grid gap-3" role="status" aria-label="Загрузка">
                      <Skeleton className="h-4 w-1/3" />
                      {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-7 w-full" />
                      ))}
                    </div>
                  }
                >
                  {(report) => <Preview report={report} />}
                </QueryState>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

function Preview({ report }: { report: Report }) {
  const counted = report.columns.filter(
    (c) => c.type === 'number' && report.totals?.[c.key] != null,
  )
  const columns = previewColumns(report)
  return (
    <>
      <p className="text-ui text-ink-muted">
        {rowCount(report.rows.length)} · {report.branch ?? 'Все филиалы'} ·{' '}
        {report.period ? periodText(report.period) : `на ${formatDate(report.generatedAt)}`}
      </p>
      {report.totals && (
        <p className="mt-1 text-ui text-ink-muted">
          Итого:{' '}
          {counted.map((c, i) => (
            <span key={c.key}>
              {i > 0 && ' · '}
              {c.header.toLowerCase()}{' '}
              <span className="font-medium text-ink tabular">
                {Number(report.totals![c.key]).toLocaleString('ru-RU')}
              </span>
            </span>
          ))}
        </p>
      )}
      <div className="mt-4">
        <DataTable
          embedded
          data={report.rows}
          columns={columns}
          pageSize={20}
          emptyTitle="В отчёт ничего не попало"
        />
      </div>
    </>
  )
}
