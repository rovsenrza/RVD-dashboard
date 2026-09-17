import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
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
import { CommandPalette } from './CommandPalette'
import { NotificationsPanel } from './NotificationsPanel'

const ROLE_LABEL: Record<Role, string> = {
  mechanic: 'Механик',
  engineer: 'Инженер',
  manager: 'Руководитель',
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
      <GlobalSearch
        className="mx-auto hidden w-full max-w-md md:block"
        onOpen={() => setSearchOpen(true)}
      />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <Button
          variant="ghost"
          size="icon"
          icon={Search}
          className="md:hidden"
          aria-label="Поиск"
          onClick={() => setSearchOpen(true)}
        />
        <Button variant="primary" size="sm" icon={Headset} className="hidden xl:inline-flex">
          Связаться со специалистом
        </Button>
        <NotificationsPanel />
        <UserMenu />
      </div>
    </header>
  )
}

function BranchSwitcher() {
  const { company, branch, branches, setBranchId } = useSession()
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
              {branch?.name ?? 'Все филиалы'}
            </span>
          </span>
          <ChevronDown size={14} className="text-ink-muted" />
        </Button>
      )}
      header={
        <div className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">Филиал</div>
      }
      items={[
        ...branches.map((b) => ({
          label: b.name,
          icon: Building2,
          onSelect: () => setBranchId(b.id),
        })),
        {
          label: 'Все филиалы компании',
          separator: true,
          onSelect: () => setBranchId(null),
        },
      ]}
    />
  )
}

/** Looks like a field, acts as a button: focus and ⌘K both open the palette. */
function GlobalSearch({ className, onOpen }: { className?: string; onOpen: () => void }) {
  return (
    <div className={className} onClick={onOpen}>
      <SearchInput
        id="global-search"
        readOnly
        value=""
        placeholder="Номер EHS, OEM, гаражный номер…"
        hint={<Kbd>⌘K</Kbd>}
        className="bg-field! [&_input]:cursor-pointer [&_input]:shadow-none [&_input]:hover:shadow-none [&_input]:focus:shadow-[inset_0_0_0_2px_var(--color-brand)]"
      />
    </div>
  )
}

function UserMenu() {
  const { user, signOut } = useSession()
  const navigate = useNavigate()
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
        {
          label: 'Выйти',
          icon: LogOut,
          danger: true,
          separator: true,
          onSelect: () => {
            signOut()
            navigate('/login', { replace: true })
          },
        },
      ]}
    />
  )
}
