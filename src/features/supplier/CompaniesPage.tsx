import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  KeyRound,
  LogIn,
  MoreHorizontal,
  Plus,
  Power,
} from 'lucide-react'
import type { SupplierCompany } from '@/entities/types'
import { ROLE_LABEL } from '@/entities/user'
import { useSession } from '@/app/session'
import { useSupplierCompanies, useSupplierResetPassword } from '@/shared/api/queries'
import { cn, plural } from '@/shared/lib/utils'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Menu,
  PageHeader,
  QueryState,
  SearchInput,
  Skeleton,
  useToast,
} from '@/shared/ui'
import { AddBranchDialog, CompanyAccessDialog, RegisterCompanyDialog } from './CompanyDialogs'

type Dialog =
  | { kind: 'register' }
  | { kind: 'branch'; company: SupplierCompany }
  | { kind: 'access'; company: SupplierCompany }

/** What a search finds in a company: itself, or only some of its people. */
function match(company: SupplierCompany, needle: string) {
  if (!needle) return { shown: true, people: company.users, opened: false }
  const own =
    company.name.toLowerCase().includes(needle) ||
    company.branches.some((b) => b.name.toLowerCase().includes(needle))
  const people = company.users.filter(
    (u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
  )
  return { shown: own || people.length > 0, people: own ? company.users : people, opened: !own }
}

/**
 * The supplier's companies (customer, 2026-10-22): every client company with its 1С
 * clients and people, one search over all of them, and a way into each cabinet — as
 * the company's hidden administrator or as one of its people — to see what they see.
 */
export function CompaniesPage() {
  const companies = useSupplierCompanies()
  const [q, setQ] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const needle = q.trim().toLowerCase()

  return (
    <>
      <PageHeader
        title="Компании"
        description="Клиенты в кабинете: филиалы из 1С, сотрудники и вход в кабинет компании"
        actions={
          <Button icon={Plus} onClick={() => setDialog({ kind: 'register' })}>
            Зарегистрировать компанию
          </Button>
        }
      />
      <Card padded={false}>
        <QueryState query={companies} skeleton={<Skeleton className="m-5 h-48" />}>
          {(list) => {
            const rows = list
              .map((c) => ({ company: c, ...match(c, needle) }))
              .filter((r) => r.shown)
            const people = list.reduce((n, c) => n + c.users.length, 0)
            return (
              <>
                <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
                  <span className="text-ui text-ink-muted tabular">
                    {list.length} {plural(list.length, 'компания', 'компании', 'компаний')} ·{' '}
                    {people} {plural(people, 'пользователь', 'пользователя', 'пользователей')}
                  </span>
                  <SearchInput
                    className="w-full sm:ml-auto sm:w-80"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Компания, филиал, ФИО или почта"
                    aria-label="Поиск по компаниям и пользователям"
                  />
                </div>
                {rows.length ? (
                  <ul className="border-t border-line">
                    {rows.map((r) => (
                      <CompanyRow
                        // A search that found people inside opens their company.
                        key={`${r.company.id}:${r.opened}`}
                        company={r.company}
                        people={r.people}
                        defaultOpen={r.opened || rows.length === 1}
                        onBranch={() => setDialog({ kind: 'branch', company: r.company })}
                        onAccess={() => setDialog({ kind: 'access', company: r.company })}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    inset
                    icon={Building2}
                    title={list.length ? 'Никого не нашли' : 'Компаний ещё нет'}
                    description={
                      list.length
                        ? 'Проверьте название, ФИО или почту'
                        : 'Зарегистрируйте первую — выберите её клиентов в 1С и администратора'
                    }
                  />
                )}
              </>
            )
          }}
        </QueryState>
      </Card>
      {dialog?.kind === 'register' && <RegisterCompanyDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'branch' && (
        <AddBranchDialog company={dialog.company} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'access' && (
        <CompanyAccessDialog company={dialog.company} onClose={() => setDialog(null)} />
      )}
    </>
  )
}

function CompanyRow({
  company,
  people,
  defaultOpen,
  onBranch,
  onAccess,
}: {
  company: SupplierCompany
  people: SupplierCompany['users']
  defaultOpen: boolean
  onBranch: () => void
  onAccess: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const enter = useEnter()
  const panel = `company-${company.id}`

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          icon={open ? ChevronDown : ChevronRight}
          aria-expanded={open}
          aria-controls={panel}
          aria-label={open ? `Свернуть ${company.name}` : `Развернуть ${company.name}`}
          onClick={() => setOpen(!open)}
        />
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('font-medium', !company.active && 'text-ink-muted')}>
              {company.name}
            </span>
            {!company.active && (
              <Badge tone="none" dot>
                Доступ отключён
              </Badge>
            )}
          </div>
          <div className="text-label text-ink-muted tabular">
            {company.branches.length}{' '}
            {plural(company.branches.length, 'филиал', 'филиала', 'филиалов')} ·{' '}
            {company.users.length}{' '}
            {plural(company.users.length, 'пользователь', 'пользователя', 'пользователей')}
          </div>
        </div>
        <div className="flex items-center gap-1.5 max-sm:w-full max-sm:pl-11">
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            disabled={!company.active || enter.busy}
            onClick={() => enter.run(company.id)}
          >
            Открыть кабинет
          </Button>
          <Menu
            trigger={() => (
              <Button
                variant="ghost"
                size="icon-sm"
                icon={MoreHorizontal}
                aria-label={`Действия с ${company.name}`}
              />
            )}
            items={[
              { label: 'Добавить филиал', icon: Plus, onSelect: onBranch },
              company.active
                ? {
                    label: 'Отключить доступ',
                    icon: Power,
                    danger: true,
                    separator: true,
                    onSelect: onAccess,
                  }
                : { label: 'Включить доступ', icon: Power, separator: true, onSelect: onAccess },
            ]}
          />
        </div>
      </div>
      {open && (
        <div
          id={panel}
          className="mx-5 mb-4 grid gap-4 rounded-lg bg-field p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
        >
          <section>
            <h3 className="mb-1.5 text-caption font-medium tracking-wide text-ink-muted uppercase">
              Клиенты 1С
            </h3>
            <ul className="grid gap-1 text-ui">
              {company.branches.map((b) => (
                <li key={b.id}>{b.name}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1.5 text-caption font-medium tracking-wide text-ink-muted uppercase">
              Пользователи
            </h3>
            {people.length ? (
              <ul className="divide-y divide-line">
                {people.map((u) => (
                  <PersonRow
                    key={u.id}
                    person={u}
                    canEnter={company.active && u.active && !enter.busy}
                    onEnter={() => enter.run(company.id, u.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-ui text-ink-muted">Пользователей нет</p>
            )}
          </section>
        </div>
      )}
    </li>
  )
}

function PersonRow({
  person: u,
  canEnter,
  onEnter,
}: {
  person: SupplierCompany['users'][number]
  canEnter: boolean
  onEnter: () => void
}) {
  const reset = useSupplierResetPassword()
  const toast = useToast()
  const [password, setPassword] = useState<string | null>(null)
  const resend = () =>
    reset.mutate(u.id, {
      onSuccess: (d) =>
        d.kind === 'email'
          ? toast(`Ссылка для входа отправлена на ${d.sentTo}`)
          : setPassword(d.password),
      onError: () => toast('Не удалось сбросить пароль', 'error'),
    })

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2 text-ui">
          <span className={cn('font-medium', !u.active && 'text-ink-muted')}>{u.name}</span>
          {!u.active && <Badge tone="none">Отключён</Badge>}
        </div>
        <div className="truncate text-label text-ink-secondary">
          {u.email} · {ROLE_LABEL[u.role]}
        </div>
        {password && (
          <div className="mt-1 text-label">
            Временный пароль: <span className="font-medium tracking-wide tabular">{password}</span>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={KeyRound}
        disabled={!u.active || reset.isPending}
        onClick={resend}
      >
        Новая ссылка
      </Button>
      <Button variant="ghost" size="sm" icon={LogIn} disabled={!canEnter} onClick={onEnter}>
        Войти как
      </Button>
    </li>
  )
}

/** Into a company's cabinet: its first screen, as it sees it. */
function useEnter() {
  const { actAs } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return {
    busy,
    run: async (companyId: string, userId?: string) => {
      setBusy(true)
      try {
        await actAs(companyId, userId)
        navigate('/', { replace: true })
      } catch {
        setBusy(false)
        toast('Не удалось открыть кабинет компании', 'error')
      }
    },
  }
}
