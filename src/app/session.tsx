import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Branch, Company } from '@/entities/types'

export type Role = 'mechanic' | 'engineer' | 'manager'

export interface Session {
  user: { id: string; name: string; role: Role }
  company: Company
  branches: Branch[]
  /** null — «все филиалы компании»: запросы уходят без сужения по филиалу. */
  branch: Branch | null
  setBranchId: (id: string | null) => void
}

const SessionContext = createContext<Session | null>(null)

/**
 * Mock session until auth lands. Swapping to a real provider (JWT → /me)
 * changes only this file; consumers keep useSession().
 */
const MOCK_USER = { id: 'u-1', name: 'Иванов Иван', role: 'engineer' as Role }
const MOCK_COMPANY: Company = { id: 'c-1', name: 'ООО «Рога и копыта»' }
const MOCK_BRANCHES: Branch[] = [
  { id: 'b-main', companyId: 'c-1', name: 'Главный филиал' },
  { id: 'b-north', companyId: 'c-1', name: 'Северный филиал' },
]

export function SessionProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchId] = useState<string | null>(MOCK_BRANCHES[0].id)

  const value = useMemo<Session>(
    () => ({
      user: MOCK_USER,
      company: MOCK_COMPANY,
      branches: MOCK_BRANCHES,
      branch: MOCK_BRANCHES.find((b) => b.id === branchId) ?? null,
      setBranchId,
    }),
    [branchId],
  )

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
