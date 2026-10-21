import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '@/app/session'
import { useTrackOrigin } from '@/shared/lib/origin'
import { ActingBanner } from './ActingBanner'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { SyncBanner } from './SyncStatus'

/** The supplier's staff work in their own section; the client screens hold no data for them. */
const STAFF_PATHS = /^\/(supplier|help)(\/|$)/

export function Layout() {
  const [open, setOpen] = useState(false)
  const { staff } = useSession()
  const { pathname } = useLocation()
  useTrackOrigin()
  if (staff && !STAFF_PATHS.test(pathname)) return <Navigate to="/supplier" replace />
  if (!staff && pathname.startsWith('/supplier')) return <Navigate to="/" replace />
  return (
    <div className="flex h-full">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setOpen(true)} />
        <ActingBanner />
        {!staff && <SyncBanner />}
        <main className="flex-1 overflow-y-auto max-sm:has-data-sticky-actions:pb-24">
          <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
