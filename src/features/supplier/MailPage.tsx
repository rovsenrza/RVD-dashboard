import { useState, type FormEvent } from 'react'
import type { SupplierMailbox } from '@/entities/types'
import { ApiError } from '@/shared/api/client'
import { useMailboxes, useSaveMailboxes } from '@/shared/api/queries'
import { Button, Card, Input, PageHeader, QueryState, Skeleton, useToast } from '@/shared/ui'

/**
 * Where letters go (customer, 2026-10-22): requests and «Связаться со специалистом» from a
 * client reach the mailbox of the supplier branch that serves it in 1С; a branch with no
 * address of its own uses the general mailbox.
 */
export function MailPage() {
  const boxes = useMailboxes()
  return (
    <>
      <PageHeader
        title="Почта"
        description="Куда уходят заявки клиентов и сообщения «Связаться со специалистом» — по филиалу поставщика, который ведёт клиента в 1С"
      />
      <QueryState query={boxes} skeleton={<Skeleton className="h-72 w-full" />}>
        {(list) => <MailForm initial={list} />}
      </QueryState>
    </>
  )
}

function MailForm({ initial }: { initial: SupplierMailbox[] }) {
  const save = useSaveMailboxes()
  const toast = useToast()
  const [boxes, setBoxes] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const general = boxes.find((b) => b.filialId === '')
  const edit = (id: string, patch: Partial<SupplierMailbox>) =>
    setBoxes((all) => all.map((b) => (b.filialId === id ? { ...b, ...patch } : b)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate(boxes, {
      onSuccess: (saved) => {
        setBoxes(saved)
        toast('Адреса сохранены')
      },
      onError: (err) =>
        setError(
          err instanceof ApiError && err.status < 500 ? err.message : 'Не удалось сохранить',
        ),
    })
  }

  return (
    <form onSubmit={submit}>
      <Card padded={false}>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 border-b border-line px-5 pt-4 pb-2 text-caption font-medium tracking-wide text-ink-muted uppercase max-md:hidden">
          <span>Филиал поставщика</span>
          <span>Заявки</span>
          <span>Связаться со специалистом</span>
        </div>
        <ul className="divide-y divide-line">
          {boxes.map((b) => {
            const own = b.filialId === ''
            return (
              <li
                key={b.filialId}
                className="grid gap-x-4 gap-y-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center"
              >
                <div>
                  <div className="font-medium">{b.name}</div>
                  {own && (
                    <div className="text-label text-ink-muted">
                      Для филиалов без своего адреса и клиентов без филиала
                    </div>
                  )}
                </div>
                <Input
                  type="email"
                  aria-label={`${b.name}: почта для заявок`}
                  value={b.requestsEmail ?? ''}
                  onChange={(e) => edit(b.filialId, { requestsEmail: e.target.value })}
                  placeholder={
                    own ? 'zakaz@vgiz.ru' : (general?.requestsEmail ?? 'как в общем ящике')
                  }
                />
                <Input
                  type="email"
                  aria-label={`${b.name}: почта для сообщений специалисту`}
                  value={b.supportEmail ?? ''}
                  onChange={(e) => edit(b.filialId, { supportEmail: e.target.value })}
                  placeholder={
                    own ? 'help@vgiz.ru' : (general?.supportEmail ?? 'как в общем ящике')
                  }
                />
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
          <p className="text-label text-ink-muted">
            Пустое поле — письма идут в общий ящик. Филиалы приходят из 1С.
          </p>
          {error && <p className="text-label text-status-replace-ink">{error}</p>}
          <Button type="submit" className="ml-auto" disabled={save.isPending}>
            {save.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </Card>
    </form>
  )
}
