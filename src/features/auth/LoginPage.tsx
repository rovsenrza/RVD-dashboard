import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/app/session'
import { ApiError } from '@/shared/api/client'
import { Button, Field, Input } from '@/shared/ui'
import { AuthFrame } from './AuthFrame'

export function LoginPage() {
  const { ready, authenticated, signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (!ready) return null
  if (authenticated) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setPending(false)
      setError(
        err instanceof ApiError && err.status !== 401
          ? 'Не удалось войти — попробуйте ещё раз'
          : 'Неверный логин или пароль',
      )
    }
  }

  return (
    <AuthFrame
      title="Вход"
      lead="Доступ выдаёт ваш поставщик РВД."
      footer="Нет доступа? Обратитесь к вашему специалисту поставщика."
    >
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
    </AuthFrame>
  )
}
