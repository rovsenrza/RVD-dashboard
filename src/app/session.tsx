import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Branch, Company, SignedIn, UserRole } from '@/entities/types'
import { isBranchBound } from '@/entities/user'
import { api, authToken } from '@/shared/api/client'
import { LIVE } from '@/shared/api/live'

export type Role = UserRole

export interface Session {
  /** False only while a live cabinet asks the server whether the sign-in still holds */
  ready: boolean
  authenticated: boolean
  /** The demo (mocks): roles can be previewed; a live cabinet signs in for real */
  demo: boolean
  user: { id: string; name: string; role: Role }
  company: Company
  branches: Branch[]
  /** null — «все филиалы компании»: запросы уходят без сужения по филиалу. */
  branch: Branch | null
  /** True for branch-bound roles (mechanic): the branch cannot be changed. */
  branchLocked: boolean
  setBranchId: (id: string | null) => void
  /** Demo only: preview the cabinet as another role. */
  setRole: (role: Role) => void
  /** Rejects with the server's reason (an ApiError) when the pair does not match */
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  /** Signed in with an administrator's one-time password: the cabinet asks for a new one first */
  mustChangePassword: boolean
  /** Replaces the signed-in person's password; rejects with the server's reason (an ApiError) */
  changePassword: (current: string, next: string) => Promise<void>
}

const AUTH_KEY = 'rvd.session'
const ROLE_KEY = 'rvd.role'
const BRANCH_KEY = 'rvd.branch'

const SessionContext = createContext<Session | null>(null)

/**
 * Two providers behind one useSession(): the demo's mock session (any
 * well-formed pair signs in, roles can be previewed) and, in live mode, the
 * real one — sign-in against the API, the company from the token.
 */
const MOCK_USER = { id: 'u-1', name: 'Иванов Иван' }
const ROLES: Role[] = ['mechanic', 'engineer', 'manager', 'admin']
const MOCK_COMPANY: Company = { id: 'c-1', name: 'ООО «Рога и копыта»' }
const MOCK_BRANCHES: Branch[] = [
  { id: 'b-main', companyId: 'c-1', name: 'Главный филиал' },
  { id: 'b-north', companyId: 'c-1', name: 'Северный филиал' },
]

const readAuth = () => {
  try {
    return localStorage.getItem(AUTH_KEY) === '1'
  } catch {
    return false
  }
}

const writeAuth = (on: boolean) => {
  try {
    if (on) localStorage.setItem(AUTH_KEY, '1')
    else localStorage.removeItem(AUTH_KEY)
  } catch {
    // Private mode or blocked storage: the session simply will not survive a reload.
  }
}

/** The branch last picked in the header; checked against the person's branches before use. */
const readBranch = (): string | null => {
  try {
    return localStorage.getItem(BRANCH_KEY)
  } catch {
    return null
  }
}

const writeBranch = (id: string | null) => {
  try {
    if (id) localStorage.setItem(BRANCH_KEY, id)
    else localStorage.removeItem(BRANCH_KEY)
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
}

const readRole = (): Role => {
  try {
    const stored = localStorage.getItem(ROLE_KEY) as Role | null
    return stored && ROLES.includes(stored) ? stored : 'engineer'
  } catch {
    return 'engineer'
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return LIVE ? (
    <LiveSessionProvider>{children}</LiveSessionProvider>
  ) : (
    <MockSessionProvider>{children}</MockSessionProvider>
  )
}

function MockSessionProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(readAuth)
  const [role, setRoleState] = useState(readRole)
  const [branchId, setBranchId] = useState<string | null>(MOCK_BRANCHES[0].id)

  const value = useMemo<Session>(
    () => ({
      ready: true,
      authenticated,
      demo: true,
      user: { ...MOCK_USER, role },
      company: MOCK_COMPANY,
      branches: MOCK_BRANCHES,
      // A branch-bound role always sees its own branch, whatever was picked before.
      branch: isBranchBound(role)
        ? MOCK_BRANCHES[0]
        : (MOCK_BRANCHES.find((b) => b.id === branchId) ?? null),
      branchLocked: isBranchBound(role),
      setBranchId,
      setRole: (next) => {
        try {
          localStorage.setItem(ROLE_KEY, next)
        } catch {
          // Storage blocked: the preview lasts until reload.
        }
        setRoleState(next)
      },
      signIn: async (email, password) => {
        // The demo signs in any well-formed pair.
        await new Promise((r) => setTimeout(r, 400))
        if (!email.includes('@') || password.length < 4)
          throw new Error('Неверный логин или пароль')
        writeAuth(true)
        setAuthenticated(true)
      },
      signOut: () => {
        writeAuth(false)
        setAuthenticated(false)
      },
      mustChangePassword: false,
      // The demo checks the new password by the real rule and keeps nothing.
      changePassword: async (current, next) => {
        await api.post('/auth/password', { current, next })
      },
    }),
    [authenticated, branchId, role],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

const NO_USER = { id: '', name: '', role: 'engineer' as Role }

/**
 * The live session (Д6): the access token stays in memory, a reload keeps the
 * sign-in through the refresh cookie, and the company is whatever the token
 * says. Its branches are the person's — the company's 1С clients, or the ones
 * the administrator bound them to: one of them is simply in scope, several can
 * be picked between or all taken together. Signing in or out drops every cached
 * answer: the next company must never glimpse the last one's hoses.
 */
function LiveSessionProvider({ children }: { children: ReactNode }) {
  const queries = useQueryClient()
  const [state, setState] = useState<{ ready: boolean; me: SignedIn | null }>({
    ready: false,
    me: null,
  })
  const [branchId, setBranchId] = useState<string | null>(readBranch)

  useEffect(() => {
    let alive = true
    const out = () => {
      queries.clear()
      if (alive) setState({ ready: true, me: null })
    }
    authToken.onExpired(out)
    // Shared with any renewal in flight: a second mount (React's dev double run) asks no second time.
    void authToken.restore().then((me) => {
      if (alive) setState({ ready: true, me })
    })
    return () => {
      alive = false
      authToken.onExpired(null)
    }
  }, [queries])

  const value = useMemo<Session>(() => {
    const branches = state.me?.branches ?? []
    const role = state.me?.user.role ?? NO_USER.role
    return {
      ready: state.ready,
      authenticated: state.me !== null,
      demo: false,
      user: state.me
        ? { id: state.me.user.id, name: state.me.user.name, role: state.me.user.role }
        : NO_USER,
      company: state.me?.company ?? { id: '', name: '' },
      branches,
      // One branch is the scope itself; of several, the one picked last, if still theirs.
      branch:
        branches.length === 1 ? branches[0] : (branches.find((b) => b.id === branchId) ?? null),
      branchLocked: isBranchBound(role),
      setBranchId: (id) => {
        writeBranch(id)
        setBranchId(id)
      },
      setRole: () => {},
      signIn: async (email, password) => {
        const me = await api.post<SignedIn>('/auth/login', { email, password })
        authToken.set(me.accessToken)
        queries.clear()
        setState({ ready: true, me })
      },
      signOut: () => {
        void api.post('/auth/logout', {}).catch(() => {})
        authToken.set(null)
        queries.clear()
        setState({ ready: true, me: null })
      },
      mustChangePassword: state.me?.mustChangePassword ?? false,
      // Every other sign-in ends on the server; this one goes on with the fresh tokens.
      changePassword: async (current, next) => {
        const me = await api.post<SignedIn>('/auth/password', { current, next })
        authToken.set(me.accessToken)
        setState({ ready: true, me })
      },
    }
  }, [state, queries, branchId])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}

/** Two letters for the avatar, from the first two words that have letters («Администратор (локально)» → «АЛ»). */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w.match(/\p{L}/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
