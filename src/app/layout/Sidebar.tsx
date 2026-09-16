import { NavLink } from 'react-router-dom'
import {
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui'

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
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-ink text-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            icon={X}
            className="text-white lg:hidden"
            onClick={onClose}
            aria-label="Закрыть меню"
          />
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white',
                  isActive && 'bg-white/10 text-brand',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 text-xs text-white/40">v0.1 · mock data</div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />}
    </>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-wide">
      <span className="size-2.5 rounded-full bg-brand" />
      РВД Кабинет
    </span>
  )
}
