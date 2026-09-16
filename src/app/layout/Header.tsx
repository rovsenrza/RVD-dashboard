import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  ChevronDown,
  Headset,
  LogOut,
  Menu as MenuIcon,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import { initials, useSession, type Role } from '@/app/session'
import { Button, Kbd, Menu, SearchInput } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'

const ROLE_LABEL: Record<Role, string> = {
  mechanic: 'Механик',
  engineer: 'Инженер',
  manager: 'Руководитель',
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate()
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-sheet px-4 shadow-[0_1px_0_var(--color-line)] lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        icon={MenuIcon}
        className="lg:hidden"
        onClick={onMenu}
        aria-label="Открыть меню"
      />
      <BranchSwitcher />
      <GlobalSearch className="mx-auto hidden w-full max-w-md md:block" />
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <Button
          variant="ghost"
          size="icon"
          icon={Search}
          className="md:hidden"
          aria-label="Поиск"
          onClick={() => navigate('/products')}
        />
        <Button variant="primary" size="sm" icon={Headset} className="hidden xl:inline-flex">
          Связаться со специалистом
        </Button>
        <Button
          variant="ghost"
          size="icon"
          icon={Bell}
          aria-label="Уведомления"
          className="relative"
        >
          <span className="absolute top-2 right-2 size-2 rounded-full bg-status-replace ring-2 ring-sheet" />
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}

function BranchSwitcher() {
  const { company, branch } = useSession()
  return (
    <Menu
      align="start"
      trigger={(open) => (
        <Button variant="ghost" size="auto" className={cn('gap-2.5', open && 'bg-black/5')}>
          <span className="grid size-8 place-items-center rounded-lg bg-field text-ink-muted">
            <Building2 size={16} strokeWidth={1.75} />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-[12px] leading-4 text-ink-muted">
              {company.name}
            </span>
            <span className="block truncate text-[13.5px] leading-4 font-medium">
              {branch.name}
            </span>
          </span>
          <ChevronDown size={14} className="text-ink-muted" />
        </Button>
      )}
      header={
        <div className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">Филиал</div>
      }
      items={[
        { label: 'Главный филиал', icon: Building2 },
        { label: 'Северный филиал', icon: Building2 },
        { label: 'Все филиалы компании', separator: true },
      ]}
    />
  )
}

function GlobalSearch({ className }: { className?: string }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) navigate(`/products?q=${encodeURIComponent(q.trim())}`)
      }}
    >
      <SearchInput
        ref={ref}
        id="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Номер EHS, OEM, гаражный номер…"
        hint={<Kbd>⌘K</Kbd>}
        className="bg-field! [&_input]:shadow-none [&_input]:hover:shadow-none [&_input]:focus:shadow-[inset_0_0_0_2px_var(--color-brand)]"
      />
    </form>
  )
}

function UserMenu() {
  const { user } = useSession()
  return (
    <Menu
      trigger={(open) => (
        <Button
          variant="ghost"
          size="auto"
          className={cn('gap-2.5 pr-1.5 pl-1', open && 'bg-black/5')}
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand text-[12px] font-semibold text-ink">
            {initials(user.name)}
          </span>
          <span className="hidden text-left md:block">
            <span className="block text-[13.5px] leading-4 font-medium">{user.name}</span>
            <span className="block text-[12px] leading-4 text-ink-muted">
              {ROLE_LABEL[user.role]}
            </span>
          </span>
          <ChevronDown size={14} className="hidden text-ink-muted md:block" />
        </Button>
      )}
      header={
        <div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-[12px] text-ink-muted">{ROLE_LABEL[user.role]}</div>
        </div>
      }
      items={[
        { label: 'Профиль', icon: UserRound, separator: true },
        { label: 'Настройки уведомлений', icon: Settings },
        { label: 'Выйти', icon: LogOut, danger: true, separator: true },
      ]}
    />
  )
}
