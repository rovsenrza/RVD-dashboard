import { Link } from 'react-router-dom'
import type { Replacement } from '@/entities/types'
import { formatUsage } from '@/entities/replacement'
import { useProductReplacements, useSetPerformer, useStaff } from '@/shared/api/queries'
import { formatDate } from '@/shared/lib/utils'
import { EmptyState, QueryState, Select, Skeleton, useToast } from '@/shared/ui'
import { AttachmentStrip } from '@/features/attachments/AttachmentStrip'

const hose = (id: string | null, serial: string | null) =>
  id && serial ? (
    <Link to={`/products/${id}`} className="font-medium text-brand-deep hover:underline">
      № {serial}
    </Link>
  ) : (
    <span className="text-ink-muted">изделие не из кабинета</span>
  )

/** What happened to this hose, told from its side: taken off, or put on in place of another. */
function Event({ r, productId }: { r: Replacement; productId: string }) {
  return r.oldProductId === productId ? (
    <>
      Снято{r.garageNumber && ` с ${r.garageNumber}`}, вместо него —{' '}
      {hose(r.newProductId, r.newSerialNumber)}
    </>
  ) : (
    <>
      Установлено{r.garageNumber && ` на ${r.garageNumber}`} вместо{' '}
      {hose(r.oldProductId, r.oldSerialNumber)}
    </>
  )
}

/**
 * Who swapped the hose on the machine. 1С does not keep it, so the client picks one of its
 * own staff here (customer, 2026-10-22).
 */
function Performer({ r }: { r: Replacement }) {
  const staff = useStaff()
  const save = useSetPerformer()
  const toast = useToast()
  const options = (staff.data ?? []).map((m) => ({ value: m.id, label: m.name }))
  // Someone since switched off still shows on the swaps they did.
  if (r.performerId && r.performedBy && !options.some((o) => o.value === r.performerId))
    options.unshift({ value: r.performerId, label: r.performedBy })
  return (
    <label className="flex items-center gap-2 text-label text-ink-muted">
      Кто менял
      <Select
        className="w-56"
        aria-label="Кто выполнил замену"
        placeholder="Не указано"
        options={options}
        value={r.performerId ?? ''}
        disabled={save.isPending}
        onChange={(e) =>
          save.mutate(
            { id: r.id, performerId: e.target.value || null },
            { onError: () => toast('Не удалось сохранить', 'error') },
          )
        }
      />
    </label>
  )
}

export function ProductReplacements({ productId }: { productId: string }) {
  const query = useProductReplacements(productId)
  return (
    <QueryState query={query} skeleton={<Skeleton className="h-16 w-full" />}>
      {(list) =>
        list.length ? (
          <ul className="-my-3 divide-y divide-line">
            {list.map((r) => {
              const usage = formatUsage(r)
              return (
                <li key={r.id} className="grid gap-0.5 py-3">
                  <div className="flex items-baseline justify-between gap-3 text-label text-ink-muted">
                    <span>
                      <span className="tabular">{formatDate(r.date)}</span>
                      {r.reason && ` · ${r.reason}`}
                    </span>
                    {usage && <span className="tabular">{usage}</span>}
                  </div>
                  <div className="text-ui">
                    <Event r={r} productId={productId} />
                  </div>
                  {r.comment && <div className="text-label text-ink-muted">{r.comment}</div>}
                  <Performer r={r} />
                  <AttachmentStrip files={r.attachments} />
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            inset
            title="Замен ещё не было"
            description="Когда это изделие снимут или поставят на замену другому, запись появится здесь."
          />
        )
      }
    </QueryState>
  )
}
