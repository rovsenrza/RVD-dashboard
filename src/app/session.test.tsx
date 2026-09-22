import { act, render, screen } from '@testing-library/react'
import { SessionProvider, useSession, type Session } from './session'

let session: Session
function Probe() {
  session = useSession()
  return <span>{session.branch?.name ?? 'Все филиалы'}</span>
}

describe('demo role', () => {
  beforeEach(() => localStorage.clear())

  it('locks a mechanic to their own branch, whatever was picked before', () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    act(() => session.setBranchId(null))
    expect(screen.getByText('Все филиалы')).toBeInTheDocument()

    act(() => session.setRole('mechanic'))
    expect(session.branchLocked).toBe(true)
    expect(screen.getByText('Главный филиал')).toBeInTheDocument()

    act(() => session.setRole('engineer'))
    expect(session.branchLocked).toBe(false)
    expect(screen.getByText('Все филиалы')).toBeInTheDocument()
  })

  it('remembers the previewed role across reloads', () => {
    const { unmount } = render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    act(() => session.setRole('admin'))
    unmount()
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )
    expect(session.user.role).toBe('admin')
  })
})
