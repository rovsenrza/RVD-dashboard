import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './session'

/** Sends a signed-out visitor to /login and brings them back to where they were after. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { authenticated } = useSession()
  const location = useLocation()
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
