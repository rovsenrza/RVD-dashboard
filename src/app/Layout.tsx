import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardList, History, LayoutDashboard, Menu, Package, Truck, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const NAV = [
  { to: '/', label: 'Главная', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Мои изделия', icon: Package },
  { to: '/equipment', label: 'Моя техника', icon: Truck },
  { to: '/replacements', label: 'История замен', icon: History },
  { to: '/requests', label: 'Заявки', icon: ClipboardList },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-full">
      {/* Sidebar — off-canvas on mobile, fixed on desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-ink text-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <span className="size-2.5 rounded-full bg-brand" />
            РВД Кабинет
          </span>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Закрыть меню">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
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
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Открыть меню">
            <Menu size={20} />
          </button>
          <div className="text-sm text-ink-muted">Главный филиал</div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">Иванов Иван</span>
            <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-ink">
              ИИ
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
