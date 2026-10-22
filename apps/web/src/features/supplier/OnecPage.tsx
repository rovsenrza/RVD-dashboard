import { useState, type FormEvent } from 'react'
import type { OnecAddress } from '@/entities/types'
import { ApiError } from '@/shared/api/client'
import { useOnecAddress, useSaveOnecAddress } from '@/shared/api/queries'
import { formatDateTime } from '@/shared/lib/utils'
import { Button, Card, Field, Input, PageHeader, QueryState, Skeleton, useToast } from '@/shared/ui'

/**
 * Where the cabinet reads 1С (customer, 2026-10-24): the base moves to another server with
 * its keys, so only the address changes. A new one is kept only once 1С answers there.
 */
export function OnecPage() {
  const address = useOnecAddress()
  return (
    <>
      <PageHeader
        title="Подключение к 1С"
        description="Адрес публикации OData, из которой кабинет берёт изделия, технику и клиентов"
      />
      <QueryState query={address} skeleton={<Skeleton className="h-56 w-full" />}>
        {(current) => <AddressForm current={current} />}
      </QueryState>
    </>
  )
}

function AddressForm({ current }: { current: OnecAddress }) {
  const save = useSaveOnecAddress()
  const toast = useToast()
  const [url, setUrl] = useState(current.url)
  const [error, setError] = useState<string | null>(null)
  const changed = url.trim().replace(/\/+$/, '') !== current.url

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate(url, {
      onSuccess: (saved) => {
        setUrl(saved.url)
        toast('1С ответила — кабинет читает её по новому адресу')
      },
      onError: (err) =>
        setError(
          err instanceof ApiError && err.status < 500 ? err.message : 'Не удалось сохранить',
        ),
    })
  }

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <Card>
        <div className="grid gap-4">
          <Field
            label="Адрес публикации 1С"
            hint="Например, https://server/base/odata/standard.odata. Логин и пароль остаются прежними."
            error={error ?? undefined}
          >
            {(id) => (
              <Input
                id={id}
                type="url"
                required
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                aria-invalid={!!error || undefined}
              />
            )}
          </Field>
          <p className="text-label text-ink-muted">
            {current.changedBy && current.changedAt
              ? `Изменил ${current.changedBy}, ${formatDateTime(current.changedAt)}`
              : 'Сейчас — адрес из настроек сервера'}
          </p>
          <p className="text-label text-ink-muted">
            Перед сохранением кабинет проверит, что 1С отвечает по новому адресу. Если не отвечает —
            адрес не сохранится и кабинет продолжит работать по прежнему. После сохранения данные
            сразу обновятся из 1С.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={!changed || save.isPending}>
              {save.isPending ? 'Проверяем 1С…' : 'Проверить и сохранить'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}
