import { useState, type FormEvent } from 'react'
import type { PasswordDelivery, SupplierCompany } from '@/entities/types'
import { ApiError } from '@/shared/api/client'
import {
  useAddCompanyBranch,
  useCreateCompany,
  useOnecClients,
  useSetCompanyActive,
} from '@/shared/api/queries'
import { Button, Dialog, Field, Input, QueryState, Skeleton, useToast } from '@/shared/ui'
import { PasswordHandover } from '@/features/admin/PasswordHandover'
import { ClientPicker } from './ClientPicker'

const reason = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.status < 500 ? error.message : fallback

/**
 * A client company from 1С clients and its first administrator (customer, 2026-10-22).
 * With mail the administrator gets an invitation; without, the one-time password shows here once.
 */
export function RegisterCompanyDialog({ onClose }: { onClose: () => void }) {
  const clients = useOnecClients()
  const create = useCreateCompany()
  const toast = useToast()
  const [keys, setKeys] = useState<string[]>([])
  const [name, setName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null)

  // The first client ticked names the company until someone types a name of their own.
  const pick = (next: string[]) => {
    if (!name.trim() && next.length)
      setName(clients.data?.find((c) => c.id === next[0])?.name ?? '')
    setKeys(next)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!keys.length) return setError('Выберите хотя бы одного клиента 1С')
    create.mutate(
      { name, clientKeys: keys, admin: { name: adminName, email } },
      {
        onSuccess: ({ delivery }: { delivery: PasswordDelivery }) => {
          if (delivery.kind === 'password')
            return setHandover({ email: email.trim(), password: delivery.password })
          toast(`Компания зарегистрирована, приглашение отправлено на ${delivery.sentTo}`)
          onClose()
        },
        onError: (err) => setError(reason(err, 'Не удалось зарегистрировать компанию')),
      },
    )
  }

  if (handover)
    return (
      <Dialog
        open
        onClose={onClose}
        title="Компания зарегистрирована"
        description="Передайте администратору почту и пароль: при первом входе он задаст свой"
        footer={<Button onClick={onClose}>Готово</Button>}
      >
        <PasswordHandover email={handover.email} password={handover.password} />
      </Dialog>
    )

  return (
    <Dialog
      open
      onClose={onClose}
      title="Регистрация компании"
      description="Компания видит в кабинете изделия и технику выбранных клиентов 1С"
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="company-form" disabled={create.isPending}>
            {create.isPending ? 'Регистрируем…' : 'Зарегистрировать'}
          </Button>
        </>
      }
    >
      <form id="company-form" onSubmit={submit} className="grid gap-4">
        <Field
          label={`Клиенты 1С${keys.length ? ` · выбрано ${keys.length}` : ''}`}
          hint="Несколько клиентов станут филиалами одной компании"
        >
          {() => (
            <QueryState query={clients} skeleton={<Skeleton className="h-64 w-full" />}>
              {(list) => <ClientPicker clients={list} value={keys} onChange={pick} />}
            </QueryState>
          )}
        </Field>
        <Field label="Название компании" hint="Так компания называется в шапке кабинета">
          {(id) => (
            <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Администратор компании, ФИО">
            {(id) => (
              <Input
                id={id}
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Его почта" error={error ?? undefined}>
            {(id) => (
              <Input
                id={id}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivanov@company.ru"
              />
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  )
}

/** One more 1С client as a branch of the company. */
export function AddBranchDialog({
  company,
  onClose,
}: {
  company: SupplierCompany
  onClose: () => void
}) {
  const clients = useOnecClients()
  const add = useAddCompanyBranch()
  const toast = useToast()
  const [keys, setKeys] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const submit = () =>
    add.mutate(
      { companyId: company.id, clientKey: keys[0] },
      {
        onSuccess: () => {
          toast('Филиал добавлен')
          onClose()
        },
        onError: (err) => setError(reason(err, 'Не удалось добавить филиал')),
      },
    )

  return (
    <Dialog
      open
      onClose={onClose}
      title="Новый филиал"
      description={`Клиент 1С станет филиалом компании ${company.name}`}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!keys.length || add.isPending}>
            Добавить филиал
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <QueryState query={clients} skeleton={<Skeleton className="h-64 w-full" />}>
          {(list) => <ClientPicker clients={list} value={keys} onChange={setKeys} single />}
        </QueryState>
        {error && <p className="text-label text-status-replace-ink">{error}</p>}
      </div>
    </Dialog>
  )
}

/** Access off ends every sign-in of the company's people at once; on lets them back. */
export function CompanyAccessDialog({
  company,
  onClose,
}: {
  company: SupplierCompany
  onClose: () => void
}) {
  const setActive = useSetCompanyActive()
  const toast = useToast()
  const off = company.active
  const confirm = () =>
    setActive.mutate(
      { companyId: company.id, active: !off },
      {
        onSuccess: () => {
          toast(off ? 'Доступ отключён' : 'Доступ включён')
          onClose()
        },
        onError: () => toast('Не удалось изменить доступ', 'error'),
      },
    )
  return (
    <Dialog
      open
      onClose={onClose}
      title={
        off
          ? `Отключить доступ компании ${company.name}?`
          : `Включить доступ компании ${company.name}?`
      }
      description={
        off
          ? 'Её сотрудники сразу выйдут из кабинета и не смогут войти, пока доступ не включат снова. Данные и пользователи сохранятся.'
          : 'Сотрудники снова смогут входить со своими паролями.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant={off ? 'danger' : 'primary'}
            onClick={confirm}
            disabled={setActive.isPending}
          >
            {off ? 'Отключить доступ' : 'Включить доступ'}
          </Button>
        </>
      }
    >
      {null}
    </Dialog>
  )
}
