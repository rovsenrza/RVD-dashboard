import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PasswordGate } from '@/features/auth/PasswordGate'
import { useSession } from './session'

/**
 * Sends a signed-out visitor to /login and brings them back to where they were after.
 * Wraps its children, or, as a layout route, the route nested under it.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { ready, authenticated, mustChangePassword } = useSession()
  const location = useLocation()
  // A live cabinet first asks whether the sign-in still holds; no flash of the login page meanwhile.
  if (!ready) return null
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  // An administrator's one-time password opens one screen: the one that replaces it.
  if (mustChangePassword) return <PasswordGate />
  return children ?? <Outlet />
}
