import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronDown,
  Lock,
  Headset,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  ScanLine,
  Search,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react'
import { initials, useSession } from '@/app/session'
import { useThemePreference, type ThemePreference } from '@/app/theme'
import { ROLE_LABEL, ROLE_ORDER } from '@/entities/user'
import {
  Button,
  Kbd,
  Menu,
  SearchInput,
  SegmentedControl,
  Select,
  Tooltip,
  type SegmentedOption,
} from '@/shared/ui'
import { cn } from '@/shared/lib/utils'
import { ScanDialog } from '@/features/scan/ScanDialog'
import { CommandPalette } from './CommandPalette'
import { NotificationsPanel } from './NotificationsPanel'

const THEME_OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'Как в системе', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
]

export function Header({ onMenu }: { onMenu: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

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
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onScan={() => setScanOpen(true)}
      />
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <Button
          variant="ghost"
          size="icon"
          icon={Search}
          className="md:hidden"
          aria-label="Поиск"
          onClick={() => setSearchOpen(true)}
        />
        {/* Camera scanning is a phone/tablet job; hidden where the pointer is a mouse. */}
        <Button
          variant="ghost"
          size="icon"
          icon={ScanLine}
          className="pointer-fine:hidden"
          aria-label="Сканировать код"
          onClick={() => setScanOpen(true)}
        />
        {scanOpen && <ScanDialog onClose={() => setScanOpen(false)} />}
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
  const { company, branch, branches, branchLocked, setBranchId } = useSession()
  const label = (
    <>
      <span className="grid size-8 place-items-center rounded-lg bg-field text-ink-muted">
        <Building2 size={16} strokeWidth={1.75} />
      </span>
      <span className="hidden min-w-0 text-left sm:block">
        <span className="block truncate text-caption leading-4 text-ink-muted">{company.name}</span>
        <span className="block truncate text-ui leading-4 font-medium">
          {branch?.name ?? 'Все филиалы'}
        </span>
      </span>
    </>
  )

  // A mechanic works inside one branch: show it, but offer nothing to switch.
  if (branchLocked)
    return (
      <Tooltip content="Механик работает в своём филиале" side="bottom">
        <span tabIndex={0} className="flex h-10 items-center gap-2.5 rounded-lg px-2">
          {label}
          <Lock
            size={13}
            strokeWidth={1.75}
            className="text-ink-faint"
            aria-label="Филиал закреплён"
          />
        </span>
      </Tooltip>
    )

  return (
    <Menu
      align="start"
      trigger={(open) => (
        <Button variant="ghost" size="auto" className={cn('gap-2.5', open && 'bg-wash')}>
          {label}
          <ChevronDown size={14} className="text-ink-muted" />
        </Button>
      )}
      header={
        <div className="text-caption font-medium tracking-wide text-ink-muted uppercase">
          Филиал
        </div>
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
  const { user, signOut, setRole } = useSession()
  const navigate = useNavigate()
  const [theme, setTheme] = useThemePreference()
  return (
    <Menu
      trigger={(open) => (
        <Button
          variant="ghost"
          size="auto"
          className={cn('gap-2.5 pr-1.5 pl-1', open && 'bg-wash')}
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand text-caption font-semibold text-on-brand">
            {initials(user.name)}
          </span>
          <span className="hidden text-left md:block">
            <span className="block text-ui leading-4 font-medium">{user.name}</span>
            <span className="block text-caption leading-4 text-ink-muted">
              {ROLE_LABEL[user.role]}
            </span>
          </span>
          <ChevronDown size={14} className="hidden text-ink-muted md:block" />
        </Button>
      )}
      header={
        <div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-caption text-ink-muted">{ROLE_LABEL[user.role]}</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-label text-ink-muted">Тема</span>
            <SegmentedControl
              label="Тема оформления"
              value={theme}
              options={THEME_OPTIONS}
              onChange={setTheme}
            />
          </div>
          {/* Until real auth: lets the customer see the cabinet through each role. */}
          <label className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-label whitespace-nowrap text-ink-muted">Роль · демо</span>
            <Select
              value={user.role}
              onChange={(e) => setRole(e.target.value as typeof user.role)}
              options={ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              className="w-40"
            />
          </label>
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
