import { NavLink } from 'react-router-dom'
import {
  Bell,
  ClipboardList,
  FileChartColumn,
  History,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Scale,
  ShieldCheck,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useSession } from '@/app/session'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui'
import { SyncFooter } from './SyncStatus'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Главная', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Мои изделия', icon: Package },
  { to: '/equipment', label: 'Моя техника', icon: Truck },
  { to: '/replacements', label: 'История замен', icon: History },
  { to: '/requests', label: 'Заявки', icon: ClipboardList },
  { to: '/notifications', label: 'Уведомления', icon: Bell },
]

/** Reports and model comparison are the manager's (ТЗ roles); the administrator sees everything. */
const REPORTS_NAV: NavItem = { to: '/reports', label: 'Отчёты', icon: FileChartColumn }
const COMPARE_NAV: NavItem = { to: '/compare', label: 'Сравнение техники', icon: Scale }
/** Users and settings belong to the administrator; the other roles never see the entry. */
const ADMIN_NAV: NavItem = { to: '/admin', label: 'Администрирование', icon: ShieldCheck }

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, demo } = useSession()
  const nav = [
    ...NAV,
    ...(user.role === 'manager' || user.role === 'admin' ? [REPORTS_NAV, COMPARE_NAV] : []),
    ...(user.role === 'admin' ? [ADMIN_NAV] : []),
  ]
  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-rail text-rail-ink transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Brand />
          <Button
            variant="rail"
            size="icon-sm"
            icon={X}
            className="lg:hidden"
            onClick={onClose}
            aria-label="Закрыть меню"
          />
        </div>

        <nav className="flex-1 space-y-0.5 px-3 pt-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3 text-ui transition-colors duration-150',
                  isActive
                    ? 'bg-brand font-medium text-on-brand'
                    : 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink',
                )
              }
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-0.5 px-3 pb-4">
          <a
            href="#help"
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-ui text-rail-muted hover:bg-rail-hover hover:text-rail-ink"
          >
            <LifeBuoy size={17} strokeWidth={1.75} />
            Помощь
          </a>
          <div className="pt-2 pr-1 pl-3 text-caption leading-5 text-rail-muted/80">
            <SyncFooter />
            <div>{demo ? 'Демо-режим · v0.2' : 'v0.2'}</div>
          </div>
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-20 bg-scrim lg:hidden" onClick={onClose} aria-hidden />
      )}
    </>
  )
}

/** The customer's ВГИЗ logo (yellow on the black rail) beside the product name. */
function Brand() {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-[-0.01em]">
      <img src="/brand/vgiz-yellow.svg" alt="ВГИЗ" className="h-8 w-auto" />
      <span className="leading-none">
        РВД Кабинет
        <span className="mt-0.5 block text-micro font-normal tracking-wide text-rail-muted uppercase">
          личный кабинет
        </span>
      </span>
    </span>
  )
}
