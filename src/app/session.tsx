import { createContext, useContext, type ReactNode } from 'react'
import type { Branch, Company } from '@/entities/types'

export type Role = 'mechanic' | 'engineer' | 'manager'

export interface Session {
  user: { id: string; name: string; role: Role }
  company: Company
  branch: Branch
}

const SessionContext = createContext<Session | null>(null)

/**
 * Mock session until auth lands. Swapping to a real provider (JWT → /me)
 * changes only this file; consumers keep useSession().
 */
const MOCK_SESSION: Session = {
  user: { id: 'u-1', name: 'Иванов Иван', role: 'engineer' },
  company: { id: 'c-1', name: 'ООО «Рога и копыта»' },
  branch: { id: 'b-main', companyId: 'c-1', name: 'Главный филиал' },
}

export function SessionProvider({
  children,
  value = MOCK_SESSION,
}: {
  children: ReactNode
  value?: Session
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
