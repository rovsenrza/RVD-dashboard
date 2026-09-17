import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session'
import { Button, Field, Input } from '@/shared/ui'

export function LoginPage() {
  const { authenticated, signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (authenticated) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    // Mock: any well-formed pair signs in. Auth against the BFF lands at Д6.
    await new Promise((r) => setTimeout(r, 400))
    if (!email.includes('@') || password.length < 4) {
      setPending(false)
      setError('Неверный логин или пароль')
      return
    }
    signIn()
    navigate(from, { replace: true })
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand">
            <span className="size-3.5 rounded-full border-[3px] border-ink" />
          </span>
          <span className="leading-none">
            <span className="block text-[17px] font-semibold tracking-[-0.01em]">РВД Кабинет</span>
            <span className="mt-1 block text-[11px] font-normal tracking-wide text-ink-muted uppercase">
              личный кабинет
            </span>
          </span>
        </div>

        <div className="sheet p-6">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Вход</h1>
          <p className="mt-1 mb-5 text-[13px] text-ink-muted">Доступ выдаёт ваш поставщик РВД.</p>

          <form onSubmit={submit} className="grid gap-4">
            <Field label="Электронная почта">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ivanov@company.ru"
                />
              )}
            </Field>
            <Field label="Пароль" error={error ?? undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? 'Входим…' : 'Войти'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12.5px] text-ink-muted">
          Нет доступа? Обратитесь к вашему специалисту поставщика.
        </p>
      </div>
    </main>
  )
}
